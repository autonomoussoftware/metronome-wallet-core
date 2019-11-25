'use strict'

const auctionMetaParser = ({ returnValues }) => ({
  metronome: {
    auction: true
  },
  returnedValue: returnValues.refund
})

function getEventDataCreator({ Auctions }) {
  const { abi, address: contractAddress, birthblock: minBlock } = Auctions

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
