'use strict'

const debug = require('debug')('metronome-wallet:core:check-chain')

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
  function start({ config, eventBus, plugins }) {
    debug('Starting')

    const { chainId } = config
    const { coin } = plugins

    const emit = {
      walletError(err) {
        debug('Wallet error: %s', err.message)
        eventBus.emit('wallet-error', {
          inner: err,
          message: `Chain validation failed: ${err.message}`,
          meta: { plugin: 'check-chain' }
        })
      }
    }

    coin.web3.eth
      .getChainId()
      .then(function(id) {
        if (id !== chainId) {
          throw new Error('Wrong chain')
        }
        debug('Chain ID %d is correct', chainId)
      })
      .catch(emit.walletError)

    return {
      events: ['wallet-error']
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
