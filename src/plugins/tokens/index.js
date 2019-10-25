'use strict'

const debug = require('debug')('metronome-wallet:core:tokens')

const createTokenApi = require('./api')

/**
 * Create the plugin.
 *
 * @returns {CorePlugin} The plugin.
 */
function createPlugin () {
  /**
   * Start the plugin.
   *
   * @param {CoreOptions} options The starting options.
   * @returns {CorePluginInterface} The plugin API.
   */
  function start ({ plugins }) {
    debug('Starting')

    const { erc20, eth, explorer } = plugins

    const api = plugins.eth
      ? createTokenApi(eth.web3Provider, erc20.abi)
      : {
        getTokenBalance: explorer.getTokenBalance,
        getTokensGasLimit: () => Promise.resolve('0') // TODO implement
      }

    return {
      api,
      name: 'tokens'
    }
  }

  /**
   * Stop the plugin.
   */
  function stop () {}

  return { start, stop }
}

module.exports = createPlugin
