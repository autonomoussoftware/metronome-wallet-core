'use strict'

const { networks, WalletRPCProvider } = require('qtumjs-wallet')
const hdkey = require('hdkey')
const mem = require('mem')
const wif = require('wif')

/**
 * Create a Qtum wallet RPC provider.
 *
 * @param {'main' | 'test'} chainId The ID of the chain.
 * @param {string} seed The wallet seed string.
 * @returns {WalletRPCProvider} A signing RPC provider.
 */
function createWalletRPCProvider (chainId, seed) {
  const { privateKey } = hdkey
    .fromMasterSeed(Buffer.from(seed, 'hex'))
    .derive("m/88'/0'/0'")

  const networkNames = { main: 'mainnet', test: 'testnet' }
  const network = networks[networkNames[chainId]]

  const encoded = wif.encode(network.info.wif, privateKey, true)

  const wallet = network.fromWIF(encoded)

  return new WalletRPCProvider(wallet)
}

module.exports = mem(createWalletRPCProvider)
