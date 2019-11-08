'use strict'

const debug = require('debug')('metronome-wallet:core:tokens-balance')

/**
 * Create the plugin.
 *
 * @returns {CorePlugin} The plugin.
 */
function createPlugin() {
  let walletId
  let accountAddress
  let registeredTokens = []

  /**
   * Start the plugin.
   *
   * @param {CoreOptions} options The starting options.
   * @returns {CorePluginInterface} The plugin API.
   */
  function start({ eventBus, plugins }) {
    const { erc20, tokens, transactionsSyncer } = plugins

    const emit = {
      balances(address) {
        registeredTokens.forEach(function({
          contractAddress,
          meta: { symbol }
        }) {
          tokens
            .getTokenBalance(contractAddress, address)
            .then(function(balance) {
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
        function(err) {
          eventBus.emit('wallet-error', {
            inner: err,
            message: `Could not get ${symbol} token balance`,
            meta: { plugin: 'tokens-balance' }
          })
        }
    }

    eventBus.on('open-wallets', function({ address, activeWallet }) {
      accountAddress = address
      walletId = activeWallet
      emit.balances(address)
    })
    eventBus.on('coin-tx', function() {
      if (accountAddress && walletId) {
        emit.balances(accountAddress)
      }
    })

    const registerToken = function(contractAddress, meta) {
      debug('Registering token', contractAddress, meta)

      if (registeredTokens.find(t => t.address === contractAddress)) {
        return
      }

      registeredTokens.push({ contractAddress, meta })
      erc20
        .getEventDataCreators(contractAddress)
        .forEach(transactionsSyncer.registerEvent)
    }

    return {
      api: {
        registerToken
      },
      events: ['wallet-state-changed', 'wallet-error'],
      name: 'tokensBalance'
    }
  }

  /**
   * Stop the plugin.
   */
  function stop() {
    walletId = null
    accountAddress = null
    registeredTokens = []
  }

  return { start, stop }
}

module.exports = createPlugin
