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

    const { explorer } = plugins

    return {
      api: {
        getTokenBalance: explorer.getTokenBalance,
        // TODO implement
        getTokensGasLimit: () => Promise.reject(new Error('Not implemented'))
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
