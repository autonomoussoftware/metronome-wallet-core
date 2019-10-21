'use strict'

const debug = require('debug')('metronome-wallet:core:eth-blocks')
const Web3 = require('web3')

const createStream = require('./blocks-stream')

/**
 * Create the plugin.
 *
 * @returns {CorePlugin} The plugin.
 */
function createPlugin () {
  let blocksStream
  let web3

  /**
   * Start the plugin.
   *
   * @param {CoreOptions} options The starting options.
   * @returns {CorePluginInterface} The plugin API.
   */
  function start ({ eventBus, plugins }) {
    debug('Initializing stream')

    web3 = new Web3(plugins.eth.web3Provider)

    blocksStream = createStream(web3)
    blocksStream.on('data', function ({ hash, number, timestamp }) {
      debug('New block', hash, number)
      eventBus.emit('coin-block', { hash, number, timestamp })
    })
    blocksStream.on('error', function (err) {
      debug('Could not get lastest block: %s', err.message)
      eventBus.emit('wallet-error', {
        inner: err,
        message: 'Could not get lastest block',
        meta: { plugin: 'explorer' }
      })
    })

    return {
      events: ['coin-block']
    }
  }

  /**
   * Stop the plugin.
   */
  function stop () {
    web3 = null
    blocksStream = blocksStream && blocksStream.destroy()
  }

  return {
    start,
    stop
  }
}

module.exports = createPlugin
