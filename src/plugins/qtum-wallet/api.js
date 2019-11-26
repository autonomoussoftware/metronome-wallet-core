'use strict'

const debug = require('debug')('metronome-wallet:core:qtum-wallet:api')

function createApi(walletRPCProvider, qtumRPC, logTransaction, toPromiEvent) {
  // Qtum does not require gas to send QTUM coins.
  const getGasLimit = () => Promise.resolve('0')

  const createAddress = seed => walletRPCProvider.fromSeed(seed).wallet.address

  function getSigningLib(privateKey) {
    const signingProvider = walletRPCProvider.fromPrivateKey(privateKey)
    return { qtumRPC, walletRPCProvider: signingProvider }
  }

  // The min relay fee is set to 90400. For a 225 bytes tx, the fee rate
  // shall be >= 402 satoshis/byte.
  function sendCoin(privateKey, { from, to, value, feeRate = 402 }) {
    debug('Sending Coin', to, value, feeRate)
    const { wallet } = getSigningLib(privateKey).walletRPCProvider
    const sendPromise = wallet.send(to, Number.parseInt(value), { feeRate })
    const promiEvent = toPromiEvent(sendPromise)
    return logTransaction(promiEvent, from)
  }

  return {
    createAddress,
    getGasLimit,
    getSigningLib,
    sendCoin
  }
}

module.exports = createApi
