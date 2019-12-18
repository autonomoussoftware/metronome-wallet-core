'use strict'

const { QtumRPC } = require('qtumjs')
const debug = require('debug')('metronome-wallet:core:qtum')
const qtumToWeb3 = require('metronome-sdk/lib/qtum-to-web3')

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
  function start({ config }) {
    debug('Starting plugin')

    const { nodeUrl } = config

    const qtumRPC = new QtumRPC(nodeUrl)

    return {
      api: qtumToWeb3({ qtumRPC }),
      name: 'web3'
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
