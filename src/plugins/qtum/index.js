'use strict'

const { identity } = require('lodash')
const { QtumRPC } = require('qtumjs')
const debug = require('debug')('metronome-wallet:core:qtum')
const qtumjslib = require('qtumjs-lib')

const checkChain = require('./check-chain')

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
  function start({ config, eventBus }) {
    debug('Starting plugin')

    const emit = {
      walletError: message =>
        function(err) {
          debug('Wallet error: %s', err.message)
          eventBus.emit('wallet-error', {
            inner: err,
            message,
            meta: { plugin: 'qtum' }
          })
        }
    }

    const qtumRPC = new QtumRPC(config.nodeUrl)

    checkChain(qtumRPC, config.chainId)
      .then(function() {
        debug('Chain ID is correct')
      })
      .catch(emit.walletError('Could not validate chain ID'))

    return {
      api: {
        getHexAddress: address => qtumRPC.getHexAddress(address),
        lib: { qtumRPC },
        parseReturnValues(returnValues, eventAbi) {
          eventAbi.inputs.forEach(function(input) {
            if (input.type !== 'address') {
              return
            }
            returnValues[input.name] = qtumjslib.address.toBase58Check(
              Buffer.from(returnValues[input.name].substr(2), 'hex'),
              qtumjslib.networks[
                config.chainId === 'test' ? 'qtum_testnet' : 'qtum'
              ].pubKeyHash
            )
          })
          return returnValues
        },
        toChecksumAddress: identity
      },
      events: ['wallet-error'],
      name: 'coin'
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
