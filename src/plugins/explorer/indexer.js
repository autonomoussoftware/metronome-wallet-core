'use strict'

const { CookieJar } = require('tough-cookie')
const { create: createAxios } = require('axios')
const { default: axiosCookieJarSupport } = require('axios-cookiejar-support')
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

  const getTransactions = (from, to, address) =>
    axios(`/addresses/${address}/transactions`, { params: { from, to } })
      .then(res => res.data)

  const getCookiePromise = useNativeCookieJar
    ? Promise.resolve()
    : pRetry(
      () =>
        axios.get('/blocks/best').then(function () {
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

        socket.on('tx', function ({ type, txid }) {
          if (type === 'eth') {
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
    getTransactions,
    getTransactionStream
  }
}

module.exports = createIndexer
