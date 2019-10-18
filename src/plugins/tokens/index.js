'use strict'

const { isAddress, toChecksumAddress } = require('web3-utils')
const debug = require('debug')('metronome-wallet:core:tokens')
const Web3 = require('web3')

const abi = require('./erc20-abi.json')
const events = require('./events')

function createPlugin () {
  const tokens = []

  const registerToken = ({ explorer }) =>
    function (contractAddress, meta) {
      debug('Registering token', contractAddress, meta)

      if (!isAddress(contractAddress)) {
        return false
      }

      const checksumAddress = toChecksumAddress(contractAddress)

      if (tokens.find(t => t.address === checksumAddress)) {
        return false
      }

      tokens.push({ contractAddress: checksumAddress, meta })

      events.getEventDataCreators(checksumAddress)
        .forEach(explorer.registerEvent)

      return true
    }

  function getTokenBalance (web3, contractAddress, address) {
    const contract = new web3.eth.Contract(abi, contractAddress)
    return contract.methods.balanceOf(address).call()
  }

  const getTokensGasLimit = web3 =>
    function ({ token: contractAddress, to, from, value }) {
      const contract = new web3.eth.Contract(abi, contractAddress)
      return contract.methods.transfer(to, value).estimateGas({ from })
        .then(gasLimit => ({ gasLimit }))
    }

  let accountAddress
  let walletId

  function start ({ config, eventBus, plugins }) {
    debug.enabled = config.debug

    const web3 = new Web3(plugins.eth.web3Provider)

    function emitBalances (address) {
      tokens.forEach(function ({ contractAddress, meta: { symbol } }) {
        getTokenBalance(web3, contractAddress, address)
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
          .catch(function (err) {
            eventBus.emit('wallet-error', {
              inner: err,
              message: `Could not get ${symbol} token balance`,
              meta: { plugin: 'tokens' }
            })
          })
      })
    }

    eventBus.on('open-wallets', function ({ address, activeWallet }) {
      accountAddress = address
      walletId = activeWallet

      emitBalances(address)
    })

    eventBus.on('coin-tx', function () {
      if (accountAddress && walletId) {
        emitBalances(accountAddress)
      }
    })

    return {
      api: {
        getTokensGasLimit: getTokensGasLimit(web3),
        registerToken: registerToken(plugins),
        metaParsers: {
          approval: events.approvalMetaParser,
          transfer: events.transferMetaParser
        }
      },
      events: [
        'wallet-error'
      ],
      name: 'tokens'
    }
  }

  function stop () {
    accountAddress = null
  }

  return { start, stop }
}

module.exports = createPlugin
