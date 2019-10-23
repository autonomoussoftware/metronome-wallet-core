'use strict'

const abi = require('./erc20-abi.json')
const mem = require('mem')
const Web3 = require('web3')

/**
 * Create ERC20 token helper methods.
 *
 * @param {object} web3Provider A Web3 provider.
 * @returns {object} The token methods.
 */
function createTokenApi (web3Provider) {
  const web3 = new Web3(web3Provider)

  const createContract = mem(
    contractAddress => new web3.eth.Contract(abi, contractAddress)
  )

  const balanceOf = (contractAddress, address) =>
    createContract(contractAddress)
      .methods.balanceOf(address)
      .call()

  const estimateTransferGas = ({ token: contractAddress, to, from, value }) =>
    createContract(contractAddress)
      .methods.transfer(to, value)
      .estimateGas({ from })
      .then(gasLimit => ({ gasLimit }))

  return {
    balanceOf,
    estimateTransferGas
  }
}

module.exports = createTokenApi
