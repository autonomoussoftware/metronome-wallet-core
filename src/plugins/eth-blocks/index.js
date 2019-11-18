'use strict'

const debug = require('debug')('metronome-wallet:core:eth-blocks')

const createStream = require('./blocks-stream')

/**
 * Create the plugin.
 *
 * @returns {CorePlugin} The plugin.
 */
function createPlugin() {
  let blocksStream

  /**
   * Start the plugin.
   *
   * @param {CoreOptions} options The starting options.
   * @returns {CorePluginInterface} The plugin API.
   */
  function start({ eventBus, plugins }) {
    debug('Initializing stream')

    const { coin } = plugins

    const emit = {
      coinBlock(header) {
        const { hash, number, timestamp } = header
        debug('New block', hash, number)
        eventBus.emit('coin-block', { hash, number, timestamp })
      },
      walletError: message =>
        function(err) {
          debug('Could not get lastest block: %s', err.message)
          eventBus.emit('wallet-error', {
            inner: err,
            message,
            meta: { plugin: 'eth-blocks' }
          })
        }
    }

    blocksStream = createStream(coin.lib)
    blocksStream.on('data', emit.coinBlock)
    blocksStream.on('error', emit.walletError('Could not get lastest block'))

    return {
      events: ['coin-block', 'wallet-error']
    }
  }

  /**
   * Stop the plugin.
   */
  function stop() {
    blocksStream = blocksStream && blocksStream.destroy()
  }

  return {
    start,
    stop
  }
}

module.exports = createPlugin
