'use strict'

const MetronomeContracts = require('metronome-contracts')

const auctionMetaParser = ({ returnValues }) => ({
  metronome: {
    auction: true
  },
  returnedValue: returnValues.refund
})

const getEventDataCreator = chain => [
  address => ({
    contractAddress: MetronomeContracts[chain].Auctions.address,
    abi: MetronomeContracts[chain].Auctions.abi,
    eventName: 'LogAuctionFundsIn',
    filter: { sender: address },
    metaParser: auctionMetaParser
  })
]

module.exports = {
  getEventDataCreator,
  auctionMetaParser
}
