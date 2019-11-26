'use strict'

function createApi(web3) {
  return {
    getBalance: address => web3.eth.getBalance(address),
    getGasPrice: () => web3.eth.getGasPrice().then(gasPrice => ({ gasPrice })),
    getPastEvents(abi, contractAddress, eventName, options) {
      const contract = new web3.eth.Contract(abi, contractAddress)
      return contract.getPastEvents(eventName, options)
    },
    getTransaction: hash => web3.eth.getTransaction(hash),
    getTransactionReceipt: hash => web3.eth.getTransactionReceipt(hash),
    subscribeToEvents(abi, contractAddress, eventName, options) {
      const contract = new web3.eth.Contract(abi, contractAddress)
      return contract.events[eventName](options)
    }
  }
}

module.exports = createApi
