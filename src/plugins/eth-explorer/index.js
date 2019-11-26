'use strict'

const debug = require('debug')('metronome-wallet:core:eth-explorer')

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

    const { coin, indexer } = plugins

    return {
      api: {
        getBalance: coin.getBalance,
        getGasPrice: coin.getGasPrice,
        getPastEvents: coin.getPastEvents,
        getTransaction: coin.getTransaction,
        getTransactionReceipt: coin.getTransactionReceipt,
        getTransactions: indexer.getTransactions,
        getTransactionStream: indexer.getTransactionStream,
        subscribeToEvents: coin.subscribeToEvents
      },
      events: [],
      name: 'explorer'
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
