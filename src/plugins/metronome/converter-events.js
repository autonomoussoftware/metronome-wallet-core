'use strict'

const MetronomeContracts = require('metronome-contracts')

const converterMetaParser = ({ event, returnValues }) => ({
  metronome: {
    converter: true
  },
  returnedValue: event === 'ConvertMetToEth' ? returnValues.eth : '0'
})

function getEventDataCreator (chain) {
  const {
    abi,
    address: contractAddress,
    birthblock: minBlock
  } = MetronomeContracts[chain].AutonomousConverter

  return [
    address => ({
      abi,
      contractAddress,
      eventName: 'ConvertEthToMet',
      filter: { from: address },
      metaParser: converterMetaParser,
      minBlock
    }),
    address => ({
      abi,
      contractAddress,
      eventName: 'ConvertMetToEth',
      filter: { from: address },
      metaParser: converterMetaParser,
      minBlock
    })
  ]
}

module.exports = {
  getEventDataCreator,
  converterMetaParser
}
