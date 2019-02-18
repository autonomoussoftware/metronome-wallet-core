'use strict'

const MetronomeContracts = require('metronome-contracts')

function getAttestationThreshold (web3, chain) {
  const { Validator } = new MetronomeContracts(web3, chain)

  return Validator.methods.threshold().call()
    .then(threshold => ({ threshold: Number.parseInt(threshold, 10) }))
}

module.exports = getAttestationThreshold
