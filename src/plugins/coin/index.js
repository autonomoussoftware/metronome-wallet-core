'use strict'

const debug = require('debug')('metronome-wallet:core:eth')

const createApi = require('./api')
const utils = require('./utils')

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

    const { web3 } = plugins

    return {
      api: {
        lib: web3,
        web3,
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
  function stop() {}

  return {
    start,
    stop
  }
}

module.exports = createPlugin
