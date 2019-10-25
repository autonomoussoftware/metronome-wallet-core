'use strict'

const mem = require('mem')
const Web3 = require('web3')

/**
 * Create ERC20 token helper methods.
 *
 * @param {object} web3Provider A Web3 provider.
 * @param {object[]} abi The ERC20 ABI.
 * @returns {object} The token methods.
 */
function createTokenApi (web3Provider, abi) {
  const web3 = new Web3(web3Provider)

  const createContract = mem(
    contractAddress => new web3.eth.Contract(abi, contractAddress)
  )

  const getTokenBalance = (contractAddress, address) =>
    createContract(contractAddress)
      .methods.getTokenBalance(address)
      .call()

  const getTokensGasLimit = ({ token: contractAddress, to, from, value }) =>
    createContract(contractAddress)
      .methods.transfer(to, value)
      .estimateGas({ from })
      .then(gasLimit => ({ gasLimit }))

  return {
    getTokenBalance,
    getTokensGasLimit
  }
}

module.exports = createTokenApi
