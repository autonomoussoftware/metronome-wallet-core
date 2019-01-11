'use strict'

const MetronomeContracts = require('metronome-contracts')

const converterMetaParser = ({ event, returnValues }) => ({
  metronome: {
    converter: true
  },
  returnedValue: event === 'ConvertMetToEth' ? returnValues.eth : '0'
})

const getEventDataCreator = chain => [
  address => ({
    contractAddress: MetronomeContracts[chain].AutonomousConverter.address,
    abi: MetronomeContracts[chain].AutonomousConverter.abi,
    eventName: 'ConvertEthToMet',
    filter: { from: address },
    metaParser: converterMetaParser
  }),
  address => ({
    contractAddress: MetronomeContracts[chain].AutonomousConverter.address,
    abi: MetronomeContracts[chain].AutonomousConverter.abi,
    eventName: 'ConvertMetToEth',
    filter: { from: address },
    metaParser: converterMetaParser
  })
]

module.exports = {
  getEventDataCreator,
  converterMetaParser
}
