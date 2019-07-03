'use strict'

const createMetronomeStatus = require('metronome-sdk-status')
const MetronomeContracts = require('metronome-contracts')

function getConverterStatus (web3, chain) {
  const contracts = new MetronomeContracts(web3, chain)
  const metronomeStatus = createMetronomeStatus(contracts)

  return metronomeStatus
    .getConverterStatus()
    .then(({ currentConverterPrice, coinBalance, metBalance }) => ({
      availableMet: metBalance,
      availableCoin: coinBalance,
      currentPrice: currentConverterPrice
    }))
}

module.exports = getConverterStatus
