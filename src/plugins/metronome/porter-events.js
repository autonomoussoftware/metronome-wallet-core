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

function getEventDataCreator (chain) {
  const {
    abi,
    address: contractAddress,
    birthblock: minBlock
  } = MetronomeContracts[chain].TokenPorter

  return [
    address => ({
      contractAddress,
      abi,
      eventName: 'LogExportReceipt',
      filter: { exporter: address },
      metaParser: exportMetaParser,
      minBlock
    }),
    address => ({
      contractAddress,
      abi,
      eventName: 'LogExportReceipt',
      filter: { destinationRecipientAddr: address },
      metaParser: exportMetaParser,
      minBlock
    }),
    address => ({
      contractAddress,
      abi,
      eventName: 'LogImportRequest',
      filter: { destinationRecipientAddr: address },
      metaParser: importRequestMetaParser,
      minBlock
    }),
    address => ({
      contractAddress,
      abi,
      eventName: 'LogImport',
      filter: { destinationRecipientAddr: address },
      metaParser: importMetaParser,
      minBlock
    })
  ]
}

module.exports = {
  getEventDataCreator,
  exportMetaParser,
  importMetaParser,
  importRequestMetaParser
}
