'use strict'

const { utils: { BN, toBN } } = require('web3')
const MetronomeContracts = require('metronome-contracts')

function getExportMetFee (web3, chain) {
  const { TokenPorter } = new MetronomeContracts(web3, chain)
  return ({ value }) =>
    Promise.all([
      TokenPorter.methods.minimumExportFee().call().then(fee => toBN(fee)),
      TokenPorter.methods.exportFee().call().then(fee => toBN(fee).divn(10000))
    ])
      .then(([minFee, feePerMet]) =>
        BN.max(minFee, feePerMet.mul(toBN(value))).toString()
      )
}

module.exports = {
  getExportMetFee
}
