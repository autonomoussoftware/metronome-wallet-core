'use strict'

function createApi(web3) {
  return {
    getBalance: address => web3.eth.getBalance(address),
    getGasPrice: () => web3.eth.getGasPrice().then(gasPrice => ({ gasPrice })),
    getTransaction: hash => web3.eth.getTransaction(hash),
    getTransactionReceipt: hash => web3.eth.getTransactionReceipt(hash)
  }
}

module.exports = createApi
