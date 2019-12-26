'use strict'

const { isAddress } = require('web3-utils')

const bytes32HexStr = /^(0x)?[0-9a-f]{64}/

function chaiCrypto(chai, utils) {
  const { Assertion } = chai

  Assertion.addProperty('eth', function() {
    utils.flag(this, 'crypto.chain', 'ethereum')
  })

  Assertion.addProperty('address', function() {
    this.assert(
      isAddress(this._obj),
      'expected #{this} to be an Ethereum address string',
      'expected #{this} to not be an Ethereum address string'
    )
  })

  Assertion.addProperty('transactionHash', function() {
    this.assert(
      typeof this._obj === 'string' && bytes32HexStr.test(this._obj),
      'expected #{this} to be an Ethereum transaction hash string',
      'expected #{this} to not be an Ethereum transaction hash string'
    )
  })

  Assertion.addProperty('blockHash', function() {
    this.assert(
      typeof this._obj === 'string' && bytes32HexStr.test(this._obj),
      'expected #{this} to be an Ethereum block hash string',
      'expected #{this} to not be an Ethereum block hash string'
    )
  })
}

module.exports = chaiCrypto
