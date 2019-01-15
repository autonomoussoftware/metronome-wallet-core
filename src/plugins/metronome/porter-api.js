'use strict'

const { utils: { BN, toBN } } = require('web3')
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

module.exports = {
  getExportMetFee
}
