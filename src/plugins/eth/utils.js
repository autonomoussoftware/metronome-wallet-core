'use strict'

const { identity } = require('lodash')
const { toChecksumAddress } = require('web3-utils')

module.exports = {
  getHexAddress: address => Promise.resolve(address),
  parseReturnValues: identity,
  toChecksumAddress
}
