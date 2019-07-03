'use strict'

const createMetronomeStatus = require('metronome-sdk-status')
const MetronomeContracts = require('metronome-contracts')

function getAuctionStatus (web3, chain) {
  const contracts = new MetronomeContracts(web3, chain)
  const metronomeStatus = createMetronomeStatus(contracts)

  return metronomeStatus
    .getAuctionStatus()
    .then(
      ({
        currAuction,
        currentAuctionPrice,
        genesisTime,
        minting,
        nextAuctionTime
      }) => ({
        currentAuction: Number.parseInt(currAuction),
        currentPrice: currentAuctionPrice,
        genesisTime,
        nextAuctionStartTime: nextAuctionTime,
        tokenRemaining: minting
      })
    )
}

module.exports = getAuctionStatus
