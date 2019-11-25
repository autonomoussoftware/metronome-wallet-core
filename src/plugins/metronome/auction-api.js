'use strict'

const { createMetronome, createProvider } = require('metronome-sdk')
const MetronomeContracts = require('metronome-contracts')

function buyMet(getSigningLib, logTransaction, metaParsers) {
  return function(privateKey, { from, value, gas, gasPrice }) {
    const signingLib = getSigningLib(privateKey)
    const met = createMetronome(createProvider.fromLib(signingLib))
    return logTransaction(
      met.buyMet(value, { gas, gasPrice }),
      from,
      metaParsers.auction({ returnValues: { refund: '0' } })
    )
  }
}

function estimateAuctionGas(web3, chain) {
  const to = MetronomeContracts[chain].Auctions.address
  return ({ from, value }) => web3.eth.estimateGas({ from, to, value })
}

module.exports = {
  buyMet,
  estimateAuctionGas
}
