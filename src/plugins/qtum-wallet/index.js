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
    const { transactionsList, web3 } = plugins

    const { qtumRPC } = web3.qtum
    const walletRPCProviderCreator = wallet.forChain(chainId.toString())

    return {
      api: {
        createPrivateKey: wallet.getPrivateKey,
        ...createApi(
          qtumRPC,
          walletRPCProviderCreator,
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
