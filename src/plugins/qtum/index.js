'use strict'

const { QtumRPC } = require('qtumjs')
const debug = require('debug')('metronome-wallet:core:qtum')

const checkChain = require('./check-chain')

/**
 * Create the plugin.
 *
 * @returns {CorePlugin} The plugin.
 */
function createPlugin() {
  /**
   * Start the plugin.
   *
   * @param {CoreOptions} options The starting options.
   * @returns {CorePluginInterface} The plugin API.
   */
  function start({ config, eventBus }) {
    debug('Starting plugin')

    const emit = {
      walletError: message =>
        function(err) {
          debug('Wallet error: %s', err.message)
          eventBus.emit('wallet-error', {
            inner: err,
            message,
            meta: { plugin: 'qtum' }
          })
        }
    }

    const qtumRPC = new QtumRPC(config.nodeUrl)

    checkChain(qtumRPC, config.chainId)
      .then(function() {
        debug('Chain ID is correct')
      })
      .catch(emit.walletError('Could not validate chain ID'))

    return {
      api: {
        qtumRPC
      },
      events: ['wallet-error'],
      name: 'qtum'
    }
  }

  /**
   * Stop the plugin.
   */
  function stop() {}

  return {
    start,
    stop
  }
}

module.exports = createPlugin
