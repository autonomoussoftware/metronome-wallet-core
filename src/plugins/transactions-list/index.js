'use strict'

const debug = require('debug')('metronome-wallet:core:tx-list')

const createLogTransaction = require('./log-transaction')
const createQueue = require('./queue')

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

    const queue = createQueue(config, eventBus, plugins)

    return {
      api: {
        addTransaction: queue.addTransaction,
        logTransaction: createLogTransaction(queue)
      },
      events: [],
      name: 'transactionsList'
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
