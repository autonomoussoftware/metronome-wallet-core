'use strict'

function createApi(web3) {
  return {
    getBalance: address => web3.eth.getBalance(address),
    getGasPrice: () => web3.eth.getGasPrice().then(gasPrice => ({ gasPrice }))
  }
}

module.exports = createApi
