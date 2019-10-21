'use strict'

const Web3 = require('web3')

const createEventsRegistry = require('./events')
const createIndexer = require('./indexer')
const createLogTransaction = require('./log-transaction')
const createQueue = require('./queue')
const createTransactionSyncer = require('./sync-transactions')
const refreshTransaction = require('./refresh-transactions')
const tryParseEventLog = require('./parse-log')

/**
 * Create the plugin.
 *
 * @returns {CorePlugin} The plugin.
 */
function createPlugin () {
  let indexer
  let syncer

  /**
   * Start the plugin.
   *
   * @param {CoreOptions} options The starting options.
   * @returns {CorePluginInterface} The plugin API.
   */
  function start ({ config, eventBus, plugins }) {
    const web3 = new Web3(plugins.eth.web3Provider)

    const eventsRegistry = createEventsRegistry()
    const queue = createQueue(config, eventBus, web3)

    indexer = createIndexer(config, eventBus)

    syncer = createTransactionSyncer(
      config,
      eventBus,
      web3,
      queue,
      eventsRegistry,
      indexer
    )

    return {
      api: {
        logTransaction: createLogTransaction(queue),
        refreshAllTransactions: syncer.refreshAllTransactions,
        refreshTransaction: refreshTransaction(web3, eventsRegistry, queue),
        registerEvent: eventsRegistry.register,
        syncTransactions: syncer.syncTransactions,
        tryParseEventLog: tryParseEventLog(web3, eventsRegistry)
      },
      events: ['indexer-connection-status-changed', 'wallet-error'],
      name: 'explorer'
    }
  }

  /**
   * Stop the plugin.
   */
  function stop () {
    indexer = indexer && indexer.disconnect()
    syncer = syncer && syncer.stop()
  }

  return {
    start,
    stop
  }
}

module.exports = createPlugin
