'use strict'

const debug = require('debug')('metronome-wallet:core:tokens')

const createTokenApi = require('./api')

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

    const { erc20, coin } = plugins

    return {
      api: createTokenApi(coin.lib, erc20.abi),
      name: 'tokens'
    }
  }

  /**
   * Stop the plugin.
   */
  function stop() {}

  return { start, stop }
}

module.exports = createPlugin
