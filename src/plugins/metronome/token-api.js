'use strict'

const MetronomeContracts = require('metronome-contracts')

function addAccount (web3, privateKey) {
  web3.eth.accounts.wallet.create(0)
    .add(web3.eth.accounts.privateKeyToAccount(privateKey))
}

function getNextNonce (web3, from) {
  return web3.eth.getTransactionCount(from, 'pending')
}

function sendMet (web3, chain, logTransaction, metaParsers) {
  const { metToken } = new MetronomeContracts(web3, chain)
  return function (privateKey, { gasPrice, gas, from, to, value }) {
    addAccount(web3, privateKey)
    return getNextNonce(web3, from)
      .then(nonce =>
        logTransaction(
          metToken.methods.transfer(to, value)
            .send({ from, gasPrice, gas, nonce }),
          from,
          metaParsers.transfer({
            address: metToken.options.address,
            returnValues: { _from: from, _to: to, _value: value }
          })
        )
      )
  }
}

function exportMet (web3, chain, logTransaction, metaParsers) {
  const { metToken } = new MetronomeContracts(web3, chain)
  return function (privateKey, params) {
    const {
      destChain,
      destMetAddr,
      extraData,
      fee,
      from,
      gas,
      gasPrice,
      to,
      value
    } = params
    addAccount(web3, privateKey)
    return getNextNonce(web3, from)
      .then(nonce =>
        logTransaction(
          metToken.methods.export(
            destChain,
            destMetAddr,
            to,
            value,
            fee,
            extraData
          )
            .send({ from, gasPrice, gas, nonce }),
          from,
          metaParsers.export(from)({
            address: from,
            returnValues: {
              destinationChain: destChain,
              destinationRecipientAddr: to,
              amountToBurn: value,
              fee
            }
          })
        )
      )
  }
}

module.exports = {
  exportMet,
  sendMet
}
