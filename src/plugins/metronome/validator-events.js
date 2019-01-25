'use strict'

const MetronomeContracts = require('metronome-contracts')

const attestationMetaParser = ({ returnValues }) => ({
  metronome: {
    attestation: {
      currentBurnHash: returnValues.hash,
      isValid: returnValues.isValid
    }
  }
})

function getEventDataCreator (chain) {
  const {
    abi,
    address: contractAddress,
    birthblock: minBlock
  } = MetronomeContracts[chain].Validator

  return [
    address => ({
      contractAddress,
      abi,
      eventName: 'LogAttestation',
      filter: { recipientAddr: address },
      metaParser: attestationMetaParser,
      minBlock
    })
  ]
}

module.exports = {
  getEventDataCreator
}
