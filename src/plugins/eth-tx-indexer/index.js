'use strict'

const { CookieJar } = require('tough-cookie')
const { create: createAxios } = require('axios').default
const { default: axiosCookieJarSupport } = require('axios-cookiejar-support')
const { isArrayLike } = require('lodash')
const debug = require('debug')('metronome-wallet:core:eth-tx-indexer')
const EventEmitter = require('events')
const io = require('socket.io-client')
const pRetry = require('p-retry')

const blockscout = require('./blockscout')

/**
 * Create the plugin.
 *
 * @returns {CorePlugin} The plugin.
 */
function createPlugin() {
  let socket

  /**
   * Start the plugin.
   *
   * @param {CoreOptions} options The starting options.
   * @returns {CorePluginInterface} The plugin API.
   */
  function start({ config, eventBus }) {
    debug('Starting')

    const { chainId, indexerUrl, useNativeCookieJar } = config

    const emit = {
      connectionStatus(connected) {
        eventBus.emit('indexer-connection-status-changed', {
          connected
        })
      }
    }

    const jar = new CookieJar()
    const axios = useNativeCookieJar
      ? createAxios({
          baseURL: indexerUrl
        })
      : axiosCookieJarSupport(
          createAxios({
            baseURL: indexerUrl,
            jar,
            withCredentials: true
          })
        )

    const getBestBlock = () =>
      axios('/blocks/best')
        .then(res => res.data)
        .then(best =>
          best && best.number && best.hash
            ? best
            : new Error('Indexer response is invalid for best block')
        )

    const getTransactions = (from, to, address) =>
      chainId === 61 // Ethereum Classic Mainnet chain ID
        ? blockscout.getTransactions(address, from, to)
        : axios(`/addresses/${address}/transactions`, { params: { from, to } })
            .then(res => res.data)
            .then(transactions =>
              isArrayLike(transactions)
                ? transactions
                : new Error(`Indexer response is invalid for ${address}`)
            )

    // TODO cancel the retry when stopping the plugin
    const getCookiePromise = useNativeCookieJar
      ? Promise.resolve()
      : pRetry(
          () =>
            getBestBlock().then(function() {
              debug('Got indexer cookie')
            }),
          {
            forever: true,
            maxTimeout: 5000,
            onFailedAttempt(err) {
              debug('Failed to get indexer cookie', err.message)
            }
          }
        )

    const getSocket = () =>
      io(`${indexerUrl}/v1`, {
        autoConnect: false,
        extraHeaders: useNativeCookieJar
          ? {}
          : { Cookie: jar.getCookiesSync(indexerUrl).join(';') }
      })

    /**
     * Create a stream that will emit an event each time a transaction for the
     * specified address is indexed.
     *
     * The stream will emit `data` for each transaction. If the connection is
     * lost or an error occurs, an `error` event will be emitted. In addition,
     * when the connection is restablished, a `resync` will be emitted.
     *
     * @param {string} address The address.
     * @returns {object} The event emitter.
     */
    function getTransactionStream(address) {
      const stream = new EventEmitter()

      getCookiePromise
        .then(function() {
          socket = getSocket()

          socket.on('connect', function() {
            debug('Indexer connected')
            emit.connectionStatus(true)
            socket.emit(
              'subscribe',
              { type: 'txs', addresses: [address] },
              function(err) {
                if (err) {
                  stream.emit('error', err)
                }
              }
            )
          })

          socket.on('tx', function(data) {
            if (!data) {
              stream.emit('error', new Error('Indexer sent no tx event data'))
              return
            }

            const { type, txid } = data

            if (type === 'eth') {
              if (typeof txid !== 'string' || txid.length !== 66) {
                stream.emit(
                  'error',
                  new Error('Indexer sent bad tx event data')
                )
                return
              }

              stream.emit('data', txid)
            }
          })

          socket.on('disconnect', function(reason) {
            debug('Indexer disconnected')
            emit.connectionStatus(false)
            stream.emit(
              'error',
              new Error(`Indexer disconnected with ${reason}`)
            )
          })

          socket.on('reconnect', function() {
            stream.emit('resync')
          })

          socket.on('error', function(err) {
            stream.emit('error', err)
          })

          socket.open()
        })
        .catch(function(err) {
          stream.emit('error', err)
        })

      return stream
    }

    return {
      api: {
        getTransactions,
        getTransactionStream
      },
      events: ['indexer-connection-status-changed'],
      name: 'indexer'
    }
  }

  /**
   * Stop the plugin.
   */
  function stop() {
    if (socket) {
      socket.close()
    }
  }

  return {
    start,
    stop
  }
}

module.exports = createPlugin
