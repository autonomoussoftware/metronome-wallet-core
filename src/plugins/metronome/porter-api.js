'use strict'

const { createMetronome, createProvider } = require('metronome-sdk')
const { MerkleTree } = require('merkletreejs')
const { toBN } = require('web3-utils')
const crypto = require('crypto')
const MetronomeContracts = require('metronome-contracts')

function getExportMetFee(coin) {
  const met = createMetronome(createProvider.fromLib(coin.lib))
  return ({ value }) => met.calcExportFee(value)
}

const sha256 = data =>
  crypto
    .createHash('sha256')
    .update(data)
    .digest()

function calcMerkleRoot(hashes) {
  const leaves = hashes.map(x => Buffer.from(x.slice(2), 'hex'))
  const tree = new MerkleTree(leaves, sha256)
  return `0x${tree.getRoot().toString('hex')}`
}

function getMerkleRoot(web3, chain) {
  const { TokenPorter } = new MetronomeContracts(web3, chain)
  return burnSeq =>
    Promise.all(
      new Array(16)
        .fill(null)
        .map((_, i) => toBN(burnSeq).subn(i))
        .filter(seq => seq.gten(0))
        .reverse()
        .map(seq => TokenPorter.methods.exportedBurns(seq.toString()).call())
    ).then(calcMerkleRoot)
}

module.exports = {
  getExportMetFee,
  getMerkleRoot
}
