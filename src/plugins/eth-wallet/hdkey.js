'use strict'

const hdkey = require('ethereumjs-wallet/hdkey')

const getWalletFromSeed = (seed, index = 0) =>
  hdkey
    .fromMasterSeed(Buffer.from(seed, 'hex'))
    .derivePath(`m/44'/60'/0'/0/${index}`)
    .getWallet()

const createAddress = (seed, index) =>
  getWalletFromSeed(seed, index).getChecksumAddressString()

const createPrivateKey = (seed, index) =>
  getWalletFromSeed(seed, index).getPrivateKeyString()

module.exports = {
  createAddress,
  createPrivateKey
}
