'use strict'

const debug = require('debug')('met-wallet:core:metronome')
const MetronomeContracts = require('metronome-contracts')
const Web3 = require('web3')

const { buyMet, estimateAuctionGas } = require('./auction-api')
const {
  convertEth,
  convertMet,
  estimateEthToMetGas,
  estimateMetToEthGas,
  getEthToMetEstimate,
  getMetToMetEstimate
} = require('./converter-api')
const { sendMet } = require('./token-api')
const getAuctionStatus = require('./auction-status')
const getConverterStatus = require('./converter-status')
const auctionEvents = require('./auction-events')
const converterEvents = require('./converter-events')

function start ({ config, eventBus, plugins }) {
  debug.enabled = config.debug

  const { chainId } = config
  const { eth, explorer, tokens } = plugins

  tokens.registerToken(MetronomeContracts.addresses[chainId].metToken, {
    decimals: 18,
    name: 'Metronome',
    symbol: 'MET'
  })

  converterEvents.getEventDataCreator(chainId)
    .concat(auctionEvents.getEventDataCreator(chainId))
    .forEach(explorer.registerEvent)

  const web3 = new Web3(eth.web3Provider)

  const emitMetronomeStatus = () =>
    Promise.all([
      getAuctionStatus(web3, chainId)
        .then(function (status) {
          eventBus.emit('auction-status-updated', status)
        }),
      getConverterStatus(web3, chainId)
        .then(function (status) {
          eventBus.emit('mtn-converter-status-updated', status)
        })
    ])
      .catch(function (err) {
        eventBus.emit('wallet-error', {
          inner: err,
          message: 'Metronome status could not be retrieved',
          meta: { plugin: 'metronome' }
        })
      })

  emitMetronomeStatus()

  eventBus.on('eth-block', emitMetronomeStatus)

  const metaParsers = Object.assign(
    {
      auction: auctionEvents.auctionMetaParser,
      converter: converterEvents.converterMetaParser
    },
    tokens.metaParsers
  )

  return {
    api: {
      buyMetronome: buyMet(
        web3,
        chainId,
        explorer.logTransaction,
        metaParsers
      ),
      convertEth: convertEth(
        web3,
        chainId,
        explorer.logTransaction,
        metaParsers
      ),
      convertMet: convertMet(web3,
        chainId,
        explorer.logTransaction,
        metaParsers
      ),
      getAuctionGasLimit: estimateAuctionGas(web3, chainId),
      getConvertEthEstimate: getEthToMetEstimate(web3, chainId),
      getConvertEthGasLimit: estimateEthToMetGas(web3, chainId),
      getConvertMetEstimate: getMetToMetEstimate(web3, chainId),
      getConvertMetGasLimit: estimateMetToEthGas(web3, chainId),
      sendMet: sendMet(web3, chainId, explorer.logTransaction, metaParsers)
    },
    events: [
      'auction-status-updated',
      'mtn-converter-status-updated',
      'wallet-error'
    ],
    name: 'metronome'
  }
}

function stop () { }

module.exports = {
  start,
  stop
}
