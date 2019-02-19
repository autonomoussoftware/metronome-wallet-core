'use strict'

const { utils: { BN, toBN } } = require('web3')
const crypto = require('crypto')
const MerkleTreeJs = require('merkletreejs')
const MetronomeContracts = require('metronome-contracts')

function getExportMetFee (web3, chain) {
  const { TokenPorter } = new MetronomeContracts(web3, chain)
  return ({ value }) =>
    Promise.all([
      TokenPorter.methods.minimumExportFee().call().then(fee => toBN(fee)),
      TokenPorter.methods.exportFee().call().then(fee => toBN(fee))
    ])
      .then(([minFee, exportFee]) =>
        BN.max(minFee, exportFee.mul(toBN(value)).divn(10000)).toString()
      )
}

const sha256 = data => crypto.createHash('sha256').update(data).digest()

function calcMerkleRoot (hashes) {
  const leaves = hashes.map(x => Buffer.from(x.slice(2), 'hex'))
  const tree = new MerkleTreeJs(leaves, sha256)
  return `0x${tree.getRoot().toString('hex')}`
}

function getMerkleRoot (web3, chain) {
  const { TokenPorter } = new MetronomeContracts(web3, chain)
  return burnSeq =>
    Promise.all(new Array(16).fill()
      .map((_, i) => toBN(burnSeq).subn(i))
      .filter(seq => seq.gten(0))
      .reverse()
      .map(seq => TokenPorter.methods.exportedBurns(seq.toString()).call())
    )
      .then(calcMerkleRoot)
}

module.exports = {
  getExportMetFee,
  getMerkleRoot
}
