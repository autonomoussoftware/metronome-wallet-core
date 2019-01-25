'use strict'

const MetronomeContracts = require('metronome-contracts')

const auctionMetaParser = ({ returnValues }) => ({
  metronome: {
    auction: true
  },
  returnedValue: returnValues.refund
})

function getEventDataCreator (chain) {
  const {
    abi,
    address: contractAddress,
    birthblock: minBlock
  } = MetronomeContracts[chain].Auctions

  return [
    address => ({
      abi,
      contractAddress,
      eventName: 'LogAuctionFundsIn',
      filter: { sender: address },
      metaParser: auctionMetaParser,
      minBlock
    })
  ]
}

module.exports = {
  getEventDataCreator,
  auctionMetaParser
}
