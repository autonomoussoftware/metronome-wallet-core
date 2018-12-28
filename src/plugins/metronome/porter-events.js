'use strict'

const MetronomeContracts = require('metronome-contracts')
const tokenPorter = require('metronome-contracts/src/abis/TokenPorter')

const exportMetaParser = (/* TODO { address, event, returnValues } */) => ({
  metronome: {
    export: true
  }
})

const getEventDataCreator = chain => [
  (/* TODO address */) => ({
    contractAddress: MetronomeContracts.addresses[chain].tokenPorter,
    abi: tokenPorter,
    eventName: 'ExportReceiptLog',
    filter: { /* TODO how to filter my events only? */ },
    metaParser: exportMetaParser
  })
]

module.exports = {
  getEventDataCreator,
  exportMetaParser
}
