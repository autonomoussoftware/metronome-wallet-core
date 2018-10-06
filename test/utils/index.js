'use strict'

const { toChecksumAddress } = require('web3-utils')
const randomstring = require('randomstring').generate

const randomHex = length => `0x${randomstring({ length, charset: 'hex' })}`

const randomAddress = () => toChecksumAddress(randomHex(40))
const randomTxId = () => randomHex(64)

module.exports = {
  randomAddress,
  randomTxId
}
