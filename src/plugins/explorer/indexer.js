'use strict'

const { CookieJar } = require('tough-cookie')
const debug = require('debug')('met-wallet:core:explorer:indexer')
const EventEmitter = require('events')
const io = require('socket.io-client')
const pRetry = require('p-retry')

const createAxiosCookiejar = require('./axios-cookiejar')

function createIndexer ({ debug: enableDebug, indexerUrl }) {
  debug.enabled = enableDebug

  const jar = new CookieJar()
  const axios = createAxiosCookiejar({ baseURL: indexerUrl }, jar)

  const getTransactions = (from, to, address) =>
    axios(`/addresses/${address}/transactions`, { params: { from, to } })
      .then(res => res.data)

  const getCookie = pRetry(
    () => axios.get('/blocks/best'),
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
      extraHeaders: { Cookie: jar.getCookiesSync(indexerUrl).join(';') }
    })

  function getTransactionStream (address) {
    const stream = new EventEmitter()

    getCookie()
      .then(function () {
        const socket = getSocket()

        socket.on('connect', function () {
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

  return {
    getTransactions,
    getTransactionStream
  }
}

module.exports = createIndexer
