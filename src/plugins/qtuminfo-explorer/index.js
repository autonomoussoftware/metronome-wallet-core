'use strict'

const debug = require('debug')('metronome-wallet:core:qtuminfo-explorer')

const createHttpApi = require('./http')
const startSocketIoConnection = require('./socket.io')

/**
 * Create the plugin.
 *
 * @returns {CorePlugin} The plugin.
 */
function createPlugin() {
  let socketApi

  /**
   * Start the plugin.
   *
   * @param {CoreOptions} options The starting options.
   * @returns {CorePluginInterface} The plugin API.
   */
  function start({ config, eventBus }) {
    debug('Starting')

    const httpApi = createHttpApi(config)

    const emit = {
      walletError: message =>
        function(err) {
          debug('Wallet error: %s', err.message)
          eventBus.emit('wallet-error', {
            inner: err,
            message,
            meta: { plugin: 'qtuminfo-explorer' }
          })
        },

      coinBlock: ({ height }) =>
        httpApi
          .getBlock(height)
          .then(function({ hash, timestamp }) {
            debug('Best block', hash, height)
            eventBus.emit('coin-block', { hash, number: height, timestamp })
          })
          .catch(emit.walletError('Could not get block')),

      connectionStatus: (connected, data) =>
        eventBus.emit('explorer-connection-status-changed', { connected, data })
    }

    // Subscribe to new blocks
    socketApi = startSocketIoConnection(config, httpApi, emit)

    // Emit the current block
    httpApi
      .getInfo()
      .then(emit.coinBlock)
      .catch(emit.walletError('Could not get blockchain info'))

    return {
      api: {
        getBalance: httpApi.getAddressBalance,
        getGasPrice: httpApi.getMinGasPrice,
        // TODO implement
        getPastEvents: () => Promise.resolve([]),
        getTokenBalance: httpApi.getAddressQrc20Balance,
        getTransaction: httpApi.getTransaction,
        getTransactionReceipt: httpApi.getTransactionReceipt,
        getTransactionStream: socketApi.getTransactionStream,
        getTransactions: httpApi.getTransactions,
        registerEvent: () => undefined // TODO implement
      },
      events: [
        'coin-block',
        'explorer-connection-status-changed',
        'wallet-error'
      ],
      name: 'explorer'
    }
  }

  /**
   * Stop the plugin.
   */
  function stop() {
    debug('Stopping')

    if (socketApi) {
      socketApi.disconnect()
    }
    socketApi = null
  }

  return {
    start,
    stop
  }
}

module.exports = createPlugin
