'use strict'

const { toChecksumAddress } = require('web3-utils')

module.exports = {
  getHexAddress: address => Promise.resolve(address),
  toChecksumAddress
}
