'use strict'

const debug = require('debug')('metronome-wallet:core:eth-wallet')
const Web3 = require('web3')

const api = require('./api')
const hdkey = require('./hdkey')

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
  function start({ plugins }) {
    debug('Starting')

    const web3 = new Web3(plugins.eth.web3Provider)

    return {
      api: {
        createAddress: hdkey.getAddress,
        createPrivateKey: hdkey.getPrivateKey,
        getGasLimit: api.estimateGas(web3),
        sendCoin: api.sendSignedTransaction(
          web3,
          plugins.explorer.logTransaction
        )
      },
      events: ['wallet-error', 'wallet-state-changed'],
      name: 'wallet'
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
