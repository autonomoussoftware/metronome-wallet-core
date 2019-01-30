'use strict'

const debug = require('debug')('met-wallet:core:wallet')
const Web3 = require('web3')

const api = require('./api')
const hdkey = require('./hdkey')

function createPlugin () {
  let addresses = []

  function start ({ config, eventBus, plugins }) {
    debug.enabled = config.debug

    const web3 = new Web3(plugins.eth.web3Provider)
    let walletId

    function emitBalance (address) {
      web3.eth.getBalance(address)
        .then(function (balance) {
          eventBus.emit('wallet-state-changed', {
            [walletId]: {
              addresses: {
                [address]: {
                  balance
                }
              }
            }
          })
        })
        .catch(function (err) {
          eventBus.emit('wallet-error', {
            inner: err,
            message: `Could not get ${config.symbol} balance`,
            meta: { plugin: 'wallet' }
          })
        })
    }

    eventBus.on('open-wallets', function ({ address, activeWallet }) {
      addresses.push(address)
      walletId = activeWallet
      emitBalance(address)
    })

    eventBus.on('coin-tx', function () {
      addresses.forEach(function (address) {
        if (walletId) {
          emitBalance(address)
        }
      })
    })

    return {
      api: {
        createAddress: hdkey.getAddress,
        createPrivateKey: hdkey.getPrivateKey,
        getAddressAndPrivateKey: hdkey.getAddressAndPrivateKey,
        getGasLimit: api.estimateGas(web3),
        getGasPrice: api.getGasPrice(web3),
        sendCoin: api.sendSignedTransaction(
          web3, plugins.explorer.logTransaction
        )
      },
      events: [
        'wallet-error',
        'wallet-state-changed'
      ],
      name: 'wallet'
    }
  }

  function stop () {
    addresses = []
  }

  return { start, stop }
}

module.exports = createPlugin
