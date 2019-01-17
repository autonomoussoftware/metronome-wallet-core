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

const getEventDataCreator = chain => [
  () => ({
    contractAddress: MetronomeContracts[chain].Validator.address,
    abi: MetronomeContracts[chain].Validator.abi,
    eventName: 'LogAttestation',
    filter: { }, // TODO filter my imports only
    metaParser: attestationMetaParser
  })
]

module.exports = {
  getEventDataCreator
}
