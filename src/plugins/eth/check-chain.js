'use strict'

const checkChain = (web3, chainId) =>
  web3.eth.net.getId()
    .then(id =>
      id === chainId || Promise.reject(new Error('Wrong chain'))
    )

module.exports = checkChain
