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

function calcMerkleRoot (hashes) {
  const leaves = hashes.map(x => Buffer.from(x.slice(2), 'hex'))
  const tree = new MerkleTreeJs(leaves, data =>
    crypto.createHash('sha256').update(data).digest()
  )
  return `0x${tree.getRoot().toString('hex')}`
}

function getMerkleRoot (web3, chain) {
  const { TokenPorter } = new MetronomeContracts(web3, chain)
  return burnSeq =>
    Promise.all(new Array(16).fill()
      .map((_, i) => burnSeq - i).reverse().filter(i => i >= 0)
      .map(seq => TokenPorter.methods.exportedBurns(seq).call())
    )
      .then(calcMerkleRoot)
}

module.exports = {
  getExportMetFee,
  getMerkleRoot
}
