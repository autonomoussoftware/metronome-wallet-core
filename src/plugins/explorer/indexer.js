'use strict'

const { CookieJar } = require('tough-cookie')
const axios = require('axios')
const axiosCookieJarSupport = require('axios-cookiejar-support').default
const debug = require('debug')('met-wallet:core:explorer:indexer')
const delay = require('delay')
const EventEmitter = require('events')
const io = require('socket.io-client')

axiosCookieJarSupport(axios)

function createIndexer ({ debug: _debug, indexerUrl }) {
  debug.enabled = _debug

  const getTransactions = (fromBlock, toBlock, address) =>
    axios({
      baseURL: indexerUrl,
      url: `/addresses/${address}/transactions`,
      params: { from: fromBlock, to: toBlock }
    })
      .then(res => res.data)

  const jar = new CookieJar()

  const getSocket = baseURL =>
    axios.get(baseURL, { jar, withCredentials: true })
      .then(() =>
        io(`${baseURL}/v1`, {
          autoConnect: false,
          extraHeaders: { Cookie: jar.getCookiesSync(baseURL).join(';') }
        })
      )
      .catch(function (err) {
        debug('Failed to get indexer cookie', err.message)

        return delay(5000)
          .then(getSocket)
      })

  function getTransactionStream (address) {
    const stream = new EventEmitter()

    getSocket(indexerUrl)
      .then(function (socket) {
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

        socket.on('disconnect', function (reason) {
          stream.emit('error', new Error(`Indexer disconnected with ${reason}`))
        })

        socket.on('reconnect', function () {
          stream.emit('resync')
        })

        socket.on('error', function (err) {
          stream.emit('error', err)
        })

        socket.on('tx', function ({ type, txid }) {
          if (type === 'eth') {
            stream.emit('data', txid)
          }
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
