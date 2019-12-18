'use strict'

const {
  checkAddressChecksum,
  fromWei,
  isAddress,
  toChecksumAddress,
  toWei
} = require('web3-utils')
const { constant, identity } = require('lodash')
const { validate } = require('wallet-address-validator')
const BigNumber = require('bignumber.js').default

BigNumber.config({ DECIMAL_PLACES: 18 })
const div18s = amount => new BigNumber(amount).div(1e18).toFixed(18)
const div8s = amount => new BigNumber(amount).div(1e8).toFixed(8)
const mul18s = amount => new BigNumber(amount).times(1e18).toFixed(0)
const mul8s = amount => new BigNumber(amount).times(1e8).toFixed(0)

const ethereumUtils = {
  checkAddressChecksum,
  fromCoin: toWei,
  fromMet: mul18s,
  isAddress,
  toCoin: fromWei,
  toChecksumAddress,
  toMet: div18s
}

const qtumUtils = network => ({
  checkAddressChecksum: constant(true),
  fromCoin: mul8s,
  fromMet: mul18s,
  isAddress: address => validate(address, 'QTUM', network),
  toCoin: div8s,
  toChecksumAddress: identity,
  toMet: div18s
})

module.exports = {
  ethereum: {
    1: ethereumUtils,
    3: ethereumUtils,
    61: ethereumUtils,
    63: ethereumUtils
  },
  qtum: {
    1364481357: qtumUtils('mainnet'),
    1364481358: qtumUtils('testnet')
  }
}
