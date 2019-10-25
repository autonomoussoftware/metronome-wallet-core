'use strict'

const debug = require('debug')('metronome-wallet:core:eth')

const { createWeb3, destroyWeb3 } = require('./web3')
const checkChain = require('./check-chain')

/**
 * Create the plugin.
 *
 * @returns {CorePlugin} The plugin.
 */
function createPlugin () {
  let web3 = null

  /**
   * Start the plugin.
   *
   * @returns {CorePluginInterface} The plugin API.
   */
  function start ({ config, eventBus }) {
    web3 = createWeb3(config, eventBus)

    checkChain(web3, config.chainId)
      .then(function () {
        debug('Chain ID is correct')
      })
      .catch(function (err) {
        eventBus.emit('wallet-error', {
          inner: err,
          message: 'Could not validate chain ID',
          meta: { plugin: 'eth' }
        })
      })

    return {
      api: {
        getBalanbce: address => web3.eth.getBalance(address),
        getGasPrice: () =>
          web3.eth.getGasPrice().then(gasPrice => ({ gasPrice })),
        web3,
        web3Provider: web3.currentProvider
      },
      events: ['wallet-error', 'web3-connection-status-changed'],
      name: 'eth'
    }
  }

  /**
   * Stop the plugin.
   */
  function stop () {
    destroyWeb3(web3)
    web3 = null
  }

  return {
    start,
    stop
  }
}

module.exports = createPlugin
