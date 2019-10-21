'use strict'

const checkChain = (qtumRPC, chainId) =>
  qtumRPC
    .rawCall('getblockchaininfo')
    .then(
      ({ chain }) =>
        chain === chainId || Promise.reject(new Error('Wrong chain'))
    )

module.exports = checkChain
