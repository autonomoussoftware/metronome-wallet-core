'use strict'

const mem = require('mem')

/**
 * Create ERC20 token helper methods.
 *
 * @param {object} web3 A Web3 instancwe.
 * @param {object[]} abi The ERC20 ABI.
 * @returns {object} The token methods.
 */
function createTokenApi(web3, abi) {
  const createContract = mem(
    contractAddress => new web3.eth.Contract(abi, contractAddress)
  )

  const getTokenBalance = (contractAddress, address) =>
    createContract(contractAddress)
      .methods.balanceOf(address)
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
