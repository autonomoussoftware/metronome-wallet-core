'use strict'

function createApi(web3) {
  const getBalance = address => web3.eth.getBalance(address)

  const getGasPrice = () =>
    web3.eth.getGasPrice().then(gasPrice => ({ gasPrice }))

  const getTransaction = hash => web3.eth.getTransaction(hash)

  const getTransactionReceipt = hash => web3.eth.getTransactionReceipt(hash)

  function getPastEvents(abi, contractAddress, eventName, options) {
    const contract = new web3.eth.Contract(abi, contractAddress)
    return contract.getPastEvents(eventName, options)
  }

  function subscribeToEvents(abi, contractAddress, eventName, options) {
    const contract = new web3.eth.Contract(abi, contractAddress)
    return contract.events[eventName](options)
  }

  return {
    getBalance,
    getGasPrice,
    getPastEvents,
    getTransaction,
    getTransactionReceipt,
    subscribeToEvents
  }
}

module.exports = createApi
