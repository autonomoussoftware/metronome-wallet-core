'use strict'

const debug = require('debug')('metronome-wallet:core:tokens')

const createTokenApi = require('./api')
const events = require('./events')

/**
 * Create the plugin.
 *
 * @returns {CorePlugin} The plugin.
 */
function createPlugin () {
  const tokens = []

  const registerToken = explorer =>
    function (contractAddress, meta) {
      debug('Registering token', contractAddress, meta)

      if (tokens.find(t => t.address === contractAddress)) {
        return
      }

      tokens.push({ contractAddress, meta })

      events
        .getEventDataCreators(contractAddress)
        .forEach(explorer.registerEvent)
    }

  let accountAddress
  let walletId

  /**
   * Start the plugin.
   *
   * @param {CoreOptions} options The starting options.
   * @returns {CorePluginInterface} The plugin API.
   */
  function start ({ eventBus, plugins }) {
    // TODO !!!!!
    const api = plugins.eth
      ? createTokenApi(plugins.eth.web3Provider)
      : {
        balanceOf: plugins.explorer.getTokenBalance
      }

    const emit = {
      balances (address) {
        tokens.forEach(function ({ contractAddress, meta: { symbol } }) {
          api
            .balanceOf(contractAddress, address)
            .then(function (balance) {
              eventBus.emit('wallet-state-changed', {
                [walletId]: {
                  addresses: {
                    [address]: {
                      token: {
                        [contractAddress]: {
                          symbol,
                          balance
                        }
                      }
                    }
                  }
                }
              })
            })
            .catch(emit.walletError(symbol))
        })
      },

      walletError: symbol =>
        function (err) {
          eventBus.emit('wallet-error', {
            inner: err,
            message: `Could not get ${symbol} token balance`,
            meta: { plugin: 'tokens' }
          })
        }
    }

    eventBus.on('open-wallets', function ({ address, activeWallet }) {
      accountAddress = address
      walletId = activeWallet
      emit.balances(address)
    })
    eventBus.on('coin-tx', function () {
      if (accountAddress && walletId) {
        emit.balances(accountAddress)
      }
    })

    return {
      api: {
        getTokensGasLimit: api.estimateTransferGas,
        registerToken: registerToken(plugins.explorer),
        metaParsers: {
          approval: events.approvalMetaParser,
          transfer: events.transferMetaParser
        }
      },
      events: ['wallet-state-changed', 'wallet-error'],
      name: 'tokens'
    }
  }

  /**
   * Stop the plugin.
   */
  function stop () {
    accountAddress = null
  }

  return { start, stop }
}

module.exports = createPlugin
