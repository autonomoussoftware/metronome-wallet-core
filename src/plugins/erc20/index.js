'use strict'

const abi = require('./abi.json')
const events = require('./events')

/**
 * Create the plugin.
 *
 * @returns {CorePlugin} The plugin.
 */
function createPlugin () {
  /**
   * Start the plugin.
   *
   * @returns {CorePluginInterface} The plugin API.
   */
  function start () {
    return {
      api: {
        abi,
        getEventDataCreators: events.getEventDataCreators,
        metaParsers: {
          approval: events.approvalMetaParser,
          transfer: events.transferMetaParser
        }
      },
      name: 'erc20'
    }
  }

  /**
   * Stop the plugin.
   */
  function stop () {}

  return { start, stop }
}

module.exports = createPlugin