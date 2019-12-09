'use strict'

const { createMetronome, createProvider } = require('metronome-sdk')

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

function estimateAuctionGas(coin) {
  const met = createMetronome(createProvider.fromLib(coin.lib))
  return ({ from, value }) => met.estimateBuyMetGas(value, { from })
}

module.exports = {
  buyMet,
  estimateAuctionGas
}
