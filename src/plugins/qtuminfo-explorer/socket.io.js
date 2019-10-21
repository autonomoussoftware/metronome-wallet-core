'use strict'

const debug = require('debug')('metronome-wallet:core:qtuminfo-explorer:socket')

const io = require('socket.io-client')
const pRetry = require('p-retry')

/**
 * Start a Socket.IO connection to the explorer. Emits an event for each new
 * block.
 *
 * @param {CoreConfig} config The configuration options.
 * @param {object} httpApi The explorer HTTP API.
 * @param {object} emit The plugin emitter functions.
 * @returns {{disconnect: () => void}} A function to close the connection.
 */
function startSocketIoConnection (config, httpApi, emit) {
  const { explorerUrl, useNativeCookieJar } = config

  const getCookiePromise = useNativeCookieJar
    ? Promise.resolve()
    : pRetry(
      () =>
        httpApi.getInfo().then(function () {
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

  let socket

  getCookiePromise
    .then(function () {
      socket = io(explorerUrl, {
        autoConnect: false,
        extraHeaders: useNativeCookieJar ? {} : { Cookie: httpApi.getCookie() }
      })

      socket.on('connect', function () {
        debug('Connected')
        emit.connectionStatus(true)
      })
      socket.on('disconnect', function (reason) {
        debug('Disconnected')
        emit.connectionStatus(false, reason)
      })

      socket.on('reconnect', function () {
        emit.connectionStatus(true)
      })

      socket.on('error', emit.walletError('Explorer connection error'))

      // Emit new blocks

      socket.on('tip', emit.coinBlock)
      socket.on('reorg', emit.coinBlock)

      socket.open()

      return socket
    })
    .catch(emit.walletError('This should never happen...'))

  return {
    disconnect () {
      if (socket) {
        socket.disconnect()
      }
    }
  }
}

module.exports = startSocketIoConnection
