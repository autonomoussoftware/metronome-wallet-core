'use strict'

const debug = require('debug')('metronome-wallet:core:qtum-wallet')

const wallet = require('./wallet')

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
  function start ({ config }) {
    debug('Starting')

    const { chainId } = config

    const walletRPCProvider = wallet.forChain(chainId)

    return {
      api: {
        createAddress: seed => walletRPCProvider.fromSeed(seed).wallet.address,
        createPrivateKey: wallet.getPrivateKey,
        // getAddressAndPrivateKey:
        // getGasLimit:
        sendCoin (privateKey, { /* from, */ to, value, feeRate = 450 }) {
          debug('Sending Coin', to, value, feeRate)
          return walletRPCProvider
            .fromPrivateKey(privateKey)
            .wallet.send(to, Number.parseInt(value), { feeRate })
            .then(function (tx) {
              debug('Transaction sent', tx.txid)
              // TODO receipt, plugins.explorer.logTransaction(promiEvent, from)
            })
        }
      },
      events: ['wallet-error', 'wallet-state-changed'],
      name: 'wallet'
    }
  }

  /**
   * Stop the plugin.
   */
  function stop () {}

  return {
    start,
    stop
  }
}

module.exports = createPlugin
