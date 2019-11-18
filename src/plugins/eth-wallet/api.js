'use strict'

function createApi(web3, logTransaction) {
  const getGasLimit = ({ from, to, value }) =>
    web3.eth.estimateGas({ from, to, value }).then(gasLimit => ({ gasLimit }))

  function addAccount(privateKey) {
    web3.eth.accounts.wallet
      .create(0)
      .add(web3.eth.accounts.privateKeyToAccount(privateKey))
  }

  function getSigningLib(privateKey) {
    addAccount(privateKey)
    return web3
  }

  const sendCoin = function(privateKey, transactionOptions) {
    const { from, to, value, gas, gasPrice } = transactionOptions
    return getSigningLib(privateKey)
      .eth.getTransactionCount(from, 'pending')
      .then(nonce =>
        logTransaction(
          web3.eth.sendTransaction({ from, to, value, gas, gasPrice, nonce }),
          from
        )
      )
  }

  return {
    getGasLimit,
    getSigningLib,
    sendCoin
  }
}

module.exports = createApi
