'use strict'

const debug = require('debug')('metronome-wallet:core:qtum-wallet')

const createApi = require('./api')
const wallet = require('./wallet')

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
  function start({ config, plugins }) {
    debug('Starting')

    const { chainId } = config
    const { coin, transactionsList } = plugins

    const walletRPCProvider = wallet.forChain(chainId.toString())

    return {
      api: {
        createAddress: seed => walletRPCProvider.fromSeed(seed).wallet.address,
        createPrivateKey: wallet.getPrivateKey,
        ...createApi(
          walletRPCProvider,
          coin.lib.qtumRPC,
          transactionsList.logTransaction
        )
      },
      name: 'wallet'
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
