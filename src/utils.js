'use strict'

const { Address, Networks } = require('qtumcore-lib')
const { constant, identity } = require('lodash')
const BigNumber = require('bignumber.js').default

BigNumber.config({ DECIMAL_PLACES: 18 })

const div18s = amount => new BigNumber(amount).div(1e18).toFixed(18)
const div8s = amount => new BigNumber(amount).div(1e8).toFixed(8)
const mul18s = amount => new BigNumber(amount).times(1e18).toFixed(0)
const mul8s = amount => new BigNumber(amount).times(1e8).toFixed(0)

module.exports = {
  ethereum: {
    1: {},
    3: {},
    61: {},
    63: {}
  },
  qtum: {
    main: {},
    test: {
      checkAddressChecksum: constant(true),
      fromCoin: mul8s,
      fromMet: mul18s,
      isAddress: address => Address.isValid(address, Networks.testnet),
      toCoin: div8s,
      toChecksumAddress: identity,
      toMet: div18s
    }
  }
}
