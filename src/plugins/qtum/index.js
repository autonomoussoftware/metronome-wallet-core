'use strict'

const { identity } = require('lodash')
const { Contract, QtumRPC } = require('qtumjs')
const debug = require('debug')('metronome-wallet:core:qtum')
const EventEmitter = require('events')
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

    function getQtumAddressSync(address) {
      return qtumjslib.address.toBase58Check(
        Buffer.from(address, 'hex'),
        qtumjslib.networks[config.chainId === 'test' ? 'qtum_testnet' : 'qtum']
          .pubKeyHash
      )
    }

    function getHexAddressSync(address) {
      return qtumjslib.address.fromBase58Check(address).hash.toString('hex')
    }

    return {
      api: {
        getHexAddress: address => qtumRPC.getHexAddress(address),
        getHexAddressSync,
        getQtumAddressSync,
        lib: { qtumRPC },
        parseReturnValues(returnValues, eventAbi) {
          eventAbi.inputs.forEach(function(input) {
            if (input.type !== 'address') {
              return
            }
            returnValues[input.name] = getQtumAddressSync(
              returnValues[input.name].substr(2)
            )
          })
          return returnValues
        },
        subscribeToEvents(abi, contractAddress, eventName, options) {
          debug('Subscribing to %s@%s', eventName, contractAddress)
          const contract = new Contract(qtumRPC, {
            abi,
            address: contractAddress
          })
          const emitter = new EventEmitter()
          const logEmitter = contract
            .logEmitter(options)
            .on(eventName, function(event) {
              emitter.emit('data', event)
            })
            .on('error', function(err) {
              emitter.emit('error', err)
            })
          emitter.unsubscribe = function() {
            logEmitter.removeAllListeners()
          }
          return emitter
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
