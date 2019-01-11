'use strict'

const MetronomeContracts = require('metronome-contracts')
const { utils: { toBN } } = require('web3')

const OVER_ESTIMATION = 1.1

function estimateCoinToMetGas (web3, chain) {
  const { AutonomousConverter } = new MetronomeContracts(web3, chain)
  return ({ from, value, minReturn = '1' }) =>
    AutonomousConverter.methods.convertEthToMet(minReturn)
      .estimateGas({ from, value })
      .then(gasLimit => ({ gasLimit: Math.round(gasLimit * OVER_ESTIMATION) }))
}

function estimateMetToCoinGas (web3, chain) {
  const { AutonomousConverter } = new MetronomeContracts(web3, chain)
  return ({ from, value, minReturn = '1' }) =>
    AutonomousConverter.methods.convertMetToEth(value, minReturn)
      .estimateGas({ from })
      .then(gasLimit => ({ gasLimit: Math.round(gasLimit * OVER_ESTIMATION) }))
}

function getCoinToMetEstimate (web3, chain) {
  const { AutonomousConverter } = new MetronomeContracts(web3, chain)
  return ({ value }) =>
    AutonomousConverter.methods.getMetForEthResult(value).call()
      .then(result => ({ result }))
}

function getMetToMetEstimate (web3, chain) {
  const { AutonomousConverter } = new MetronomeContracts(web3, chain)
  return ({ value }) =>
    AutonomousConverter.methods.getEthForMetResult(value).call()
      .then(result => ({ result }))
}

function addAccount (web3, privateKey) {
  web3.eth.accounts.wallet.create(0)
    .add(web3.eth.accounts.privateKeyToAccount(privateKey))
}

function convertCoin (web3, chain, logTransaction, metaParsers) {
  const { AutonomousConverter } = new MetronomeContracts(web3, chain)

  return function (privateKey, transactionObject) {
    const { gasPrice, gas, value, from, minReturn = 1 } = transactionObject

    addAccount(web3, privateKey)

    return web3.eth.getTransactionCount(from, 'pending')
      .then(nonce =>
        logTransaction(
          AutonomousConverter.methods.convertEthToMet(minReturn)
            .send({ from, gas, gasPrice, value, nonce }),
          from,
          metaParsers.converter({ event: 'ConvertEthToMet' })
        )
      )
  }
}

function convertMet (web3, chain, logTransaction, metaParsers) {
  const { AutonomousConverter, METToken } = new MetronomeContracts(web3, chain)

  const converterAddress = AutonomousConverter.options.address
  const metTokenAddress = METToken.options.address

  return function (privateKey, transactionObject) {
    const { gasPrice, gas, value, from, minReturn = 1 } = transactionObject

    addAccount(web3, privateKey)

    const approvalMeta = _value => metaParsers.approval({
      address: metTokenAddress,
      returnValues: { _owner: from, _spender: converterAddress, _value }
    })
    const transferMeta = metaParsers.transfer({
      address: metTokenAddress,
      returnValues: { _from: from, _to: converterAddress, _value: value }
    })
    const converterMeta = metaParsers.converter({
      event: 'ConvertMetToEth',
      returnValues: minReturn
    })
    const conversionMeta = Object.assign(transferMeta, converterMeta)

    return Promise.all([
      METToken.methods.allowance(from, converterAddress).call(),
      web3.eth.getTransactionCount(from, 'pending')
    ])
      .then(function ([remaining, nonce]) {
        if (toBN(remaining).gtn(0) && toBN(remaining).lt(toBN(value))) {
          return Promise.all([
            logTransaction(
              METToken.methods.approve(converterAddress, 0)
                .send({ from, gasPrice, gas, nonce }),
              from,
              approvalMeta('0')
            ),
            logTransaction(
              METToken.methods.approve(converterAddress, value)
                .send({ from, gasPrice, gas, nonce: nonce + 1 }),
              from,
              approvalMeta(value)
            ),
            logTransaction(
              AutonomousConverter.methods.convertMetToEth(value, minReturn)
                .send({ from, gasPrice, gas, nonce: nonce + 2 }),
              from,
              conversionMeta
            )
          ])
            .then(([_, __, res]) => res) // eslint-disable-line no-unused-vars
        }
        if (toBN(remaining).eqn(0)) {
          return Promise.all([
            logTransaction(
              METToken.methods.approve(converterAddress, value)
                .send({ from, gasPrice, gas, nonce }),
              from,
              approvalMeta(value)
            ),
            logTransaction(
              AutonomousConverter.methods.convertMetToEth(value, minReturn)
                .send({ from, gasPrice, gas, nonce: nonce + 1 }),
              from,
              conversionMeta
            )
          ])
            .then(([_, res]) => res) // eslint-disable-line no-unused-vars
        }
        return logTransaction(
          AutonomousConverter.methods.convertMetToEth(value, minReturn)
            .send({ from, gasPrice, gas, nonce }),
          from,
          conversionMeta
        )
      })
  }
}

module.exports = {
  convertCoin,
  convertMet,
  estimateCoinToMetGas,
  estimateMetToCoinGas,
  getCoinToMetEstimate,
  getMetToMetEstimate
}
