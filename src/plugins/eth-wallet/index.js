'use strict'

const debug = require('debug')('metronome-wallet:core:eth-wallet')

const createApi = require('./api')
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

    const { coin, transactionsList } = plugins

    return {
      api: {
        ...hdkey,
        ...createApi(coin.lib, transactionsList.logTransaction)
      },
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
