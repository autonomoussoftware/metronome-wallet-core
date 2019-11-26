'use strict'

const debug = require('debug')('metronome-wallet:core:eth')

const { createWeb3, destroyWeb3 } = require('./web3')
const checkChain = require('./check-chain')
const createApi = require('./api')
const utils = require('./utils')

/**
 * Create the plugin.
 *
 * @returns {CorePlugin} The plugin.
 */
function createPlugin() {
  let web3 = null

  /**
   * Start the plugin.
   *
   * @returns {CorePluginInterface} The plugin API.
   */
  function start({ config, eventBus }) {
    debug('Starting')

    const { chainId, web3Timeout, wsApiUrl } = config

    const emit = {
      connectionStatus(connected) {
        eventBus.emit('web3-connection-status-changed', { connected })
      },
      walletError: message =>
        function(err) {
          debug('Wallet error: %s', err.message)
          eventBus.emit('wallet-error', {
            inner: err,
            message,
            meta: { plugin: 'eth' }
          })
        }
    }

    web3 = createWeb3(wsApiUrl, web3Timeout, emit)

    checkChain(web3, chainId)
      .then(function() {
        debug('Chain ID is correct')
      })
      .catch(emit.walletError('Could not validate chain ID'))

    return {
      api: {
        lib: web3,
        ...createApi(web3),
        ...utils
      },
      events: ['wallet-error', 'web3-connection-status-changed'],
      name: 'coin'
    }
  }

  /**
   * Stop the plugin.
   */
  function stop() {
    destroyWeb3(web3)
    web3 = null
  }

  return {
    start,
    stop
  }
}

module.exports = createPlugin
