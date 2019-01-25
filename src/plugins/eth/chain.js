'use strict'

const { eq } = require('lodash/fp')

const checkChainId = (web3, chainId) =>
  web3.eth.net.getId()
    .then(eq(chainId))

module.exports = {
  checkChainId
}
