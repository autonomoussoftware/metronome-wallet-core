'use strict'

const MetronomeContracts = require('metronome-contracts')

const exportMetaParser = walletAddress => ({ address, returnValues }) => ({
  metronome: {
    export: {
      destChain: returnValues.destinationChain,
      to: returnValues.destinationRecipientAddr,
      value: returnValues.amountToBurn,
      fee: returnValues.fee,
      burnHash: returnValues.currentBurnHash
    }
  },
  discard: address !== walletAddress
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
  address => ({
    contractAddress: MetronomeContracts[chain].TokenPorter.address,
    abi: MetronomeContracts[chain].TokenPorter.abi,
    eventName: 'ExportReceiptLog',
    filter: { /* TODO how to filter by my events only? */ },
    metaParser: exportMetaParser(address)
  }),
  address => ({
    contractAddress: MetronomeContracts[chain].TokenPorter.address,
    abi: MetronomeContracts[chain].TokenPorter.abi,
    eventName: 'LogImport',
    filter: { destinationRecipientAddr: address },
    metaParser: importMetaParser
  })
]

module.exports = {
  getEventDataCreator,
  exportMetaParser
}
