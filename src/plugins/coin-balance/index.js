'use strict'

const debug = require('debug')('metronome-wallet:core:coin-balance')

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
  function start({ config, eventBus, plugins }) {
    debug('Starting')

    const { symbol } = config
    const { explorer } = plugins

    let _activeWallet
    const addresses = {}

    const emit = {
      balance(address) {
        explorer
          .getBalance(address)
          .then(function(balance) {
            eventBus.emit('wallet-state-changed', {
              [_activeWallet]: {
                addresses: {
                  [address]: {
                    balance
                  }
                }
              }
            })
          })
          .catch(function(err) {
            eventBus.emit('wallet-error', {
              inner: err,
              message: `Could not get ${symbol} balance`,
              meta: { plugin: 'wallet' }
            })
          })
      }
    }

    eventBus.on('open-wallets', function({ address, activeWallet }) {
      debug('Opening wallets')

      addresses[activeWallet] = addresses[activeWallet] || []
      addresses[activeWallet].push(address)
      _activeWallet = activeWallet

      emit.balance(address)
    })
    eventBus.on('coin-tx', function() {
      if (_activeWallet) {
        addresses[_activeWallet].forEach(function(address) {
          emit.balance(address)
        })
      }
    })

    return {
      events: ['wallet-error', 'wallet-state-changed']
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
