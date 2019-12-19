'use strict'

const { networks, WalletRPCProvider } = require('qtumjs-wallet')
const hdkey = require('hdkey')
const mem = require('mem')
const wif = require('wif')

/**
 * Obtain the private key from a seed.
 *
 * @param {string} seed The wallet seed string.
 * @returns {string} The private key.
 */
function getPrivateKey(seed) {
  const { privateKey } = hdkey
    .fromMasterSeed(Buffer.from(seed, 'hex'))
    .derive("m/88'/0'/0'")
  return privateKey.toString('hex')
}

/**
 * Create a Qtum wallet RPC providers for the specified chain.
 *
 * @param {string} chainId The EIP-155 ID of the chain.
 * @returns {object} The provider creators.
 */
function forChain(chainId) {
  const networkNames = { 1364481357: 'mainnet', 1364481358: 'testnet' }
  const network = networks[networkNames[chainId]]

  /**
   * Create a Qtum wallet RPC provider from a private key.
   *
   * @param {string} privateKey The wallet seed string.
   * @returns {WalletRPCProvider} A signing RPC provider.
   */
  function fromPrivateKey(privateKey) {
    const encoded = wif.encode(
      network.info.wif,
      Buffer.from(privateKey, 'hex'),
      true
    )
    const wallet = network.fromWIF(encoded)
    return new WalletRPCProvider(wallet)
  }

  /**
   * Create a Qtum wallet RPC provider from a seed.
   *
   * @param {string} seed The wallet seed string.
   * @returns {WalletRPCProvider} A signing RPC provider.
   */
  function fromSeed(seed) {
    return fromPrivateKey(getPrivateKey(seed))
  }

  return {
    fromSeed: mem(fromSeed),
    fromPrivateKey: mem(fromPrivateKey)
  }
}

module.exports = {
  forChain: mem(forChain),
  getPrivateKey: mem(getPrivateKey)
}
