'use strict'

const debug = require('debug')('metronome-wallet:core:qtum-wallet')

const createWalletRPCProvider = require('./wallet')

/**
 * Create the plugin.
 *
 * @returns {CorePlugin} The plugin.
 */
function createPlugin () {
  /**
   * Start the plugin.
   *
   * @param {CoreOptions} options The starting options.
   * @returns {CorePluginInterface} The plugin API.
   */
  function start ({ config }) {
    debug('Starting')

    const { chainId } = config

    return {
      api: {
        createAddress: seed =>
          createWalletRPCProvider(chainId, seed).wallet.address
        // createPrivateKey:
        // getAddressAndPrivateKey:
        // getGasLimit:
        // getGasPrice:
        // sendCoin:
      },
      events: ['wallet-error', 'wallet-state-changed'],
      name: 'wallet'
    }
  }

  /**
   * Stop the plugin.
   */
  function stop () {}

  return {
    start,
    stop
  }
}

module.exports = createPlugin
