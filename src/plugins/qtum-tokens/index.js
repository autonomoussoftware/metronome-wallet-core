'use strict'

const debug = require('debug')('metronome-wallet:core:tokens')

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

    const { explorer, wallet } = plugins

    return {
      api: {
        getTokenBalance: explorer.getTokenBalance,
        getTokensGasLimit: wallet.getTokensGasLimit
      },
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
