'use strict'

const debug = require('debug')('metronome-wallet:core:explorer')

const createIndexer = require('./eth-tx-indexer')

/**
 * Create the plugin.
 *
 * @returns {CorePlugin} The plugin.
 */
function createPlugin() {
  let indexer
  let syncer

  /**
   * Start the plugin.
   *
   * @param {CoreOptions} options The starting options.
   * @returns {CorePluginInterface} The plugin API.
   */
  function start({ config, eventBus, plugins }) {
    debug('Starting')

    const { coin } = plugins

    indexer = createIndexer(config, eventBus)

    return {
      api: {
        getBalance: coin.getBalance,
        getGasPrice: coin.getGasPrice,
        getPastEvents: coin.getPastEvents,
        getTransaction: coin.getTransaction,
        getTransactionReceipt: coin.getTransactionReceipt,
        getTransactions: indexer.getTransactions,
        getTransactionStream: indexer.getTransactionStream
      },
      events: ['indexer-connection-status-changed', 'wallet-error'],
      name: 'explorer'
    }
  }

  /**
   * Stop the plugin.
   */
  function stop() {
    indexer = indexer && indexer.disconnect()
    syncer = syncer && syncer.stop()
  }

  return {
    start,
    stop
  }
}

module.exports = createPlugin
