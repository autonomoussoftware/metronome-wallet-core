'use strict'

const MetronomeContracts = require('metronome-contracts')
const tokenPorter = require('metronome-contracts/src/abis/TokenPorter')

const exportMetaParser = ({ address, returnValues }) => ({
  metronome: {
    export: {
      from: address,
      destChain: returnValues.destinationChain,
      to: returnValues.destinationRecipientAddr,
      value: returnValues.amountToBurn,
      fee: returnValues.fee,
      burnHash: returnValues.currentBurnHash
    }
  }
})

const importMetaParser = ({ returnValues }) => ({
  metronome: {
    import: {
      originChain: returnValues.originChain,
      to: returnValues.destinationRecipientAddr,
      value: returnValues.amountImported,
      burnHash: returnValues.currentHash
    }
  }
})

const getEventDataCreator = chain => [
  (/* TODO address */) => ({
    contractAddress: MetronomeContracts.addresses[chain].tokenPorter,
    abi: tokenPorter,
    eventName: 'ExportReceiptLog',
    filter: { /* TODO how to filter my events only? */ },
    metaParser: exportMetaParser
  }),
  address => ({
    contractAddress: MetronomeContracts.addresses[chain].tokenPorter,
    abi: tokenPorter,
    eventName: 'LogImport',
    filter: { destinationRecipientAddr: address },
    metaParser: importMetaParser
  })
]

module.exports = {
  getEventDataCreator,
  exportMetaParser
}
