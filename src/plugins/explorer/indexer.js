'use strict'

const { CookieJar } = require('tough-cookie')
const { create: createAxios } = require('axios')
const { default: axiosCookieJarSupport } = require('axios-cookiejar-support')
const { isArrayLike } = require('lodash')
const debug = require('debug')('met-wallet:core:explorer:indexer')
const EventEmitter = require('events')
const io = require('socket.io-client')
const pRetry = require('p-retry')

function createIndexer (config, eventBus) {
  const { debug: enableDebug, indexerUrl, useNativeCookieJar } = config

  debug.enabled = enableDebug

  let axios
  let jar
  let socket

  if (useNativeCookieJar) {
    axios = createAxios({
      baseURL: indexerUrl
    })
  } else {
    jar = new CookieJar()
    axios = axiosCookieJarSupport(createAxios(({
      baseURL: indexerUrl,
      jar,
      withCredentials: true
    })))
  }

  const getBestBlock = () =>
    axios('/blocks/best')
      .then(res => res.data)
      .then(best =>
        best && best.number && best.hash
          ? best
          : new Error('Indexer\' response is invalid for best block')
      )

  const getTransactions = (from, to, address) =>
    axios(`/addresses/${address}/transactions`, { params: { from, to } })
      .then(res => res.data)
      .then(transactions =>
        isArrayLike(transactions)
          ? transactions
          : new Error('Indexer response is invalid for address\' transactions')
      )

  const getCookiePromise = useNativeCookieJar
    ? Promise.resolve()
    : pRetry(
      () =>
        getBestBlock()
          .then(function () {
            debug('Got indexer cookie')
          }),
      {
        forever: true,
        maxTimeout: 5000,
        onFailedAttempt (err) {
          debug('Failed to get indexer cookie', err.message)
        }
      }
    )

  const getSocket = () =>
    io(`${indexerUrl}/v1`, {
      autoConnect: false,
      extraHeaders: jar
        ? { Cookie: jar.getCookiesSync(indexerUrl).join(';') }
        : {}
    })

  function getTransactionStream (address) {
    const stream = new EventEmitter()

    getCookiePromise
      .then(function () {
        socket = getSocket()

        socket.on('connect', function () {
          debug('Indexer connected')
          eventBus.emit('indexer-connection-status-changed', {
            connected: true
          })
          socket.emit(
            'subscribe',
            { type: 'txs', addresses: [address] },
            function (err) {
              if (err) {
                stream.emit('error', err)
              }
            }
          )
        })

        socket.on('tx', function (data) {
          if (!data) {
            stream.emit('error', new Error('Indexer sent no tx event data'))
            return
          }

          const { type, txid } = data

          if (type === 'eth') {
            if (typeof txid !== 'string' || txid.length !== 66) {
              stream.emit('error', new Error('Indexer sent bad tx event data'))
              return
            }

            stream.emit('data', txid)
          }
        })

        socket.on('disconnect', function (reason) {
          debug('Indexer disconnected')
          eventBus.emit('indexer-connection-status-changed', {
            connected: false
          })
          stream.emit('error', new Error(`Indexer disconnected with ${reason}`))
        })

        socket.on('reconnect', function () {
          stream.emit('resync')
        })

        socket.on('error', function (err) {
          stream.emit('error', err)
        })

        socket.open()
      })
      .catch(function (err) {
        stream.emit('error', err)
      })

    return stream
  }

  function disconnect () {
    if (socket) {
      socket.close()
    }
  }

  return {
    disconnect,
    getBestBlock,
    getTransactions,
    getTransactionStream
  }
}

module.exports = createIndexer
