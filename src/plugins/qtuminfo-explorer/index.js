'use strict'

const { CookieJar } = require('tough-cookie')
const { create: createAxios } = require('axios').default
const { default: axiosCookieJarSupport } = require('axios-cookiejar-support')
const debug = require('debug')('metronome-wallet:core:qtuminfo-explorer')
const io = require('socket.io-client')
const pRetry = require('p-retry')

/**
 * Create the plugin.
 *
 * @returns {CorePlugin} The plugin.
 */
function createPlugin () {
  let socket

  /**
   * Start the plugin.
   *
   * @param {CoreOptions} options The starting options.
   * @returns {CorePluginInterface} The plugin API.
   */
  function start ({ config, eventBus }) {
    debug('Starting')

    const { indexerUrl, useNativeCookieJar } = config

    // Create cookiejar and axios

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

    // Define explorer access functions

    const getInfo = () => axios('/api/info').then(res => res.data)
    const getBlock = hashOrNumber =>
      axios(`/api/block/${hashOrNumber}`).then(res => res.data)

    // Define plugin emitters

    const emitWalletError = message =>
      function (err) {
        debug('Wallet error: %s', err.message)
        eventBus.emit('wallet-error', {
          inner: err,
          message,
          meta: { plugin: 'qtuminfo-explorer' }
        })
      }

    const emitCoinBlock = ({ height }) =>
      getBlock(height)
        .then(function ({ hash, timestamp }) {
          debug('Best block', hash, height)
          eventBus.emit('coin-block', { hash, number: height, timestamp })
        })
        .catch(emitWalletError('Could not get block'))

    const emitConnectionStatus = (connected, data) =>
      eventBus.emit('explorer-connection-status-changed', { connected, data })

    // Obtain a cookie and create a Socket.IO connection

    const getCookiePromise = useNativeCookieJar
      ? Promise.resolve()
      : pRetry(
        () =>
          getInfo().then(function () {
            debug('Got explorer cookie')
          }),
        {
          forever: true,
          maxTimeout: 5000,
          onFailedAttempt (err) {
            debug('Failed to get explorer cookie', err.message)
          }
        }
      )

    getCookiePromise
      .then(function () {
        socket = io(indexerUrl, {
          autoConnect: false,
          extraHeaders: jar
            ? { Cookie: jar.getCookiesSync(indexerUrl).join(';') }
            : {}
        })

        socket.on('connect', function () {
          debug('Connected')
          emitConnectionStatus(true)
        })
        socket.on('disconnect', function (reason) {
          debug('Disconnected')
          emitConnectionStatus(false, reason)
        })

        socket.on('reconnect', function () {
          emitConnectionStatus(true)
        })

        socket.on('error', emitWalletError('Explorer connection error'))

        // Emit new blocks

        socket.on('tip', emitCoinBlock)
        socket.on('reorg', emitCoinBlock)

        socket.open()
      })
      .catch(emitWalletError('Something very wrong happened...'))

    // Emit the current block

    getInfo()
      .then(emitCoinBlock)
      .catch(emitWalletError('Could not get blockchain info'))

    return {
      events: ['coin-block', 'qtum-explorer', 'wallet-error']
    }
  }

  /**
   * Stop the plugin.
   */
  function stop () {
    debug('Stopping')

    if (socket) {
      socket.disconnect()
    }
    socket = null
  }

  return {
    start,
    stop
  }
}

module.exports = createPlugin
