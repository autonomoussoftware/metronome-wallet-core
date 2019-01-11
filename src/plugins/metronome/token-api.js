'use strict'

const { utils: { toHex } } = require('web3')
const crypto = require('crypto')
const MerkleTreeJs = require('merkletreejs')
const MetronomeContracts = require('metronome-contracts')

function addAccount (web3, privateKey) {
  web3.eth.accounts.wallet.create(0)
    .add(web3.eth.accounts.privateKeyToAccount(privateKey))
}

function getNextNonce (web3, from) {
  return web3.eth.getTransactionCount(from, 'pending')
}

function sendMet (web3, chain, logTransaction, metaParsers) {
  const { METToken } = new MetronomeContracts(web3, chain)
  return function (privateKey, { gasPrice, gas, from, to, value }) {
    addAccount(web3, privateKey)
    return getNextNonce(web3, from)
      .then(nonce =>
        logTransaction(
          METToken.methods.transfer(to, value)
            .send({ from, gasPrice, gas, nonce }),
          from,
          metaParsers.transfer({
            address: METToken.options.address,
            returnValues: { _from: from, _to: to, _value: value }
          })
        )
      )
  }
}

function exportMet (web3, chain, logTransaction, metaParsers) {
  const { METToken } = new MetronomeContracts(web3, chain)
  return function (privateKey, params) {
    const {
      destinationChain,
      destinationMetAddress,
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
          METToken.methods.export(
            toHex(destinationChain),
            destinationMetAddress,
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
              amountToBurn: value,
              destinationChain: toHex(destinationChain),
              destinationRecipientAddr: to,
              fee
            }
          })
        )
      )
  }
}

function getMerkleRoot (hashes) {
  const leaves = hashes.map(x => Buffer.from(x.slice(2), 'hex'))
  const tree = new MerkleTreeJs(leaves, data =>
    crypto.createHash('sha256').update(data).digest()
  )
  return `0x${tree.getRoot().toString('hex')}`
}

function importMet (web3, chain, logTransaction, metaParsers) {
  const { METToken } = new MetronomeContracts(web3, chain)
  return function (privateKey, params) {
    const {
      blockTimestamp,
      burnSequence,
      currentBurnHash,
      currentTick,
      dailyAuctionStartTime,
      dailyMintable,
      destinationChain,
      destinationMetAddress,
      extraData,
      fee,
      from,
      gas,
      gasPrice,
      genesisTime,
      originChain,
      previousBurnHash,
      supply,
      value
    } = params
    addAccount(web3, privateKey)
    return getNextNonce(web3, from)
      .then(nonce =>
        logTransaction(
          METToken.methods.importMET(
            toHex(originChain),
            toHex(destinationChain),
            [destinationMetAddress, from],
            extraData,
            [previousBurnHash, currentBurnHash],
            supply,
            [
              blockTimestamp,
              value,
              fee,
              currentTick,
              genesisTime,
              dailyMintable,
              burnSequence,
              dailyAuctionStartTime
            ],
            getMerkleRoot([previousBurnHash, currentBurnHash])
          )
            .send({ from, gasPrice, gas, nonce }),
          from,
          metaParsers.import(from)({
            returnValues: {
              currentBurnHash,
              originChain: toHex(originChain),
              to: from,
              value
            }
          })
        )
      )
  }
}

module.exports = {
  exportMet,
  importMet,
  sendMet
}
