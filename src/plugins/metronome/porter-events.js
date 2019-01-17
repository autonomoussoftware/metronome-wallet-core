'use strict'

const { utils: { hexToUtf8 } } = require('web3')
const MetronomeContracts = require('metronome-contracts')

const exportMetaParser = ({ returnValues }) => ({
  metronome: {
    export: {
      blockTimestamp: returnValues.blockTimestamp,
      burnSequence: returnValues.burnSequence,
      currentBurnHash: returnValues.currentBurnHash,
      currentTick: returnValues.currentTick,
      dailyAuctionStartTime: returnValues.dailyAuctionStartTime,
      dailyMintable: returnValues.dailyMintable,
      destinationChain: hexToUtf8(returnValues.destinationChain),
      fee: returnValues.fee,
      genesisTime: returnValues.genesisTime,
      previousBurnHash: returnValues.prevBurnHash,
      supply: returnValues.supplyOnAllChains,
      to: returnValues.destinationRecipientAddr,
      value: returnValues.amountToBurn
    }
  }
})

const importRequestMetaParser = ({ returnValues }) => ({
  metronome: {
    importRequest: {
      currentBurnHash: returnValues.currentBurnHash,
      fee: returnValues.fee,
      originChain: hexToUtf8(returnValues.originChain),
      to: returnValues.destinationRecipientAddr,
      value: returnValues.amountToImport
    }
  }
})

const importMetaParser = ({ returnValues }) => ({
  metronome: {
    import: {
      currentBurnHash: returnValues.currentHash,
      fee: returnValues.fee,
      originChain: hexToUtf8(returnValues.originChain),
      to: returnValues.destinationRecipientAddr,
      value: returnValues.amountImported
    }
  }
})

const getEventDataCreator = chain => [
  address => ({
    contractAddress: MetronomeContracts[chain].TokenPorter.address,
    abi: MetronomeContracts[chain].TokenPorter.abi,
    eventName: 'LogExportReceipt',
    filter: { exporter: address },
    metaParser: exportMetaParser
  }),
  address => ({
    contractAddress: MetronomeContracts[chain].TokenPorter.address,
    abi: MetronomeContracts[chain].TokenPorter.abi,
    eventName: 'LogImportRequest',
    filter: { destinationRecipientAddr: address },
    metaParser: importRequestMetaParser
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
  exportMetaParser,
  importMetaParser,
  importRequestMetaParser
}
