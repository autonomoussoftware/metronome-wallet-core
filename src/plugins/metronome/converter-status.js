'use strict'

const MetronomeContracts = require('metronome-contracts')
const promiseAllProps = require('promise-all-props')

function getConverterStatus (web3, chain) {
  const { AutonomousConverter } = new MetronomeContracts(web3, chain)

  const {
    getMetBalance,
    getEthBalance,
    getEthForMetResult
  } = AutonomousConverter.methods

  return promiseAllProps({
    availableMet: getMetBalance().call(),
    availableCoin: getEthBalance().call(),
    currentPrice: getEthForMetResult(web3.utils.toWei('1')).call()
  })
}

module.exports = getConverterStatus
