'use strict'

const debug = require('debug')('metronome-wallet:core:qtum-wallet:api')
const qtumToWeb3 = require('metronome-sdk/lib/qtum-to-web3')

function createApi(qtumRPC, walletRPCProviderCreator, logTransaction) {
  // Qtum does not require gas to send QTUM coins.
  const getGasLimit = () => Promise.resolve('0')

  const createAddress = seed =>
    walletRPCProviderCreator.fromSeed(seed).wallet.address

  function getSigningLib(privateKey) {
    const walletRPCProvider = walletRPCProviderCreator.fromPrivateKey(
      privateKey
    )
    return { qtumRPC, walletRPCProvider }
  }

  function sendCoin(privateKey, transactionOptions) {
    // The min relay fee is set to 90400. For a 225 bytes tx, the fee rate shall
    // be >= 402 satoshis/byte.
    const { from, to, value, feeRate = 402 } = transactionOptions
    debug('Sending Coin', to, value, feeRate)

    const walletRPCProvider = walletRPCProviderCreator.fromPrivateKey(
      privateKey
    )
    const web3 = qtumToWeb3({ qtumRPC, walletRPCProvider })
    return logTransaction(
      web3.eth.sendTransaction({ from, to, value, feeRate }),
      from
    )
  }

  return {
    createAddress,
    getGasLimit,
    getSigningLib,
    sendCoin
  }
}

module.exports = createApi
