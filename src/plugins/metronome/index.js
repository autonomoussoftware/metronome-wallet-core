'use strict'

const debug = require('debug')('met-wallet:core:metronome')
const MetronomeContracts = require('metronome-contracts')
const Web3 = require('web3')

const {
  buyMet,
  estimateAuctionGas
} = require('./auction-api')
const {
  convertCoin,
  convertMet,
  estimateCoinToMetGas,
  estimateMetToCoinGas,
  getCoinToMetEstimate,
  getMetToMetEstimate
} = require('./converter-api')
const {
  getExportMetFee
} = require('./porter-api')
const {
  estimateExportMetGas,
  estimateImportMetGas,
  exportMet,
  importMet,
  sendMet
} = require('./token-api')
const getAttestationThreshold = require('./validator-status')
const getAuctionStatus = require('./auction-status')
const getConverterStatus = require('./converter-status')
const auctionEvents = require('./auction-events')
const converterEvents = require('./converter-events')
const porterEvents = require('./porter-events')
const validatorEvents = require('./validator-events')

function createPlugin () {
  function start ({ config, eventBus, plugins }) {
    debug.enabled = config.debug

    const { chainId, gasOverestimation } = config
    const { eth, explorer, tokens } = plugins

    const web3 = new Web3(eth.web3Provider)

    // Register MET token
    tokens.registerToken(MetronomeContracts[chainId].METToken.address, {
      decimals: 18,
      name: 'Metronome',
      symbol: 'MET'
    })

    // Register all MET events
    const events = []
    events
      .concat(auctionEvents.getEventDataCreator(chainId))
      .concat(converterEvents.getEventDataCreator(chainId))
      .concat(porterEvents.getEventDataCreator(chainId))
      .concat(validatorEvents.getEventDataCreator(chainId))
      .forEach(explorer.registerEvent)

    // Start emitting MET status
    const emitMetronomeStatus = () =>
      Promise.all([
        getAuctionStatus(web3, chainId)
          .then(function (status) {
            eventBus.emit('auction-status-updated', status)
          }),
        getConverterStatus(web3, chainId)
          .then(function (status) {
            eventBus.emit('converter-status-updated', status)
          }),
        getAttestationThreshold(web3, chainId)
          .then(function (status) {
            eventBus.emit('attestation-threshold-updated', status)
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

    eventBus.on('coin-block', emitMetronomeStatus)

    // Collect meta parsers
    const metaParsers = Object.assign(
      {
        auction: auctionEvents.auctionMetaParser,
        converter: converterEvents.converterMetaParser,
        export: porterEvents.exportMetaParser,
        import: porterEvents.importMetaParser,
        importRequest: porterEvents.importRequestMetaParser
      },
      tokens.metaParsers
    )

    // Define gas over-estimation wrapper
    const over = fn =>
      (...args) =>
        fn(...args).then(gas =>
          ({ gasLimit: Math.round(gas * gasOverestimation) })
        )

    // Build and return API
    return {
      api: {
        buyMetronome: buyMet(
          web3,
          chainId,
          explorer.logTransaction,
          metaParsers
        ),
        convertCoin: convertCoin(
          web3,
          chainId,
          explorer.logTransaction,
          metaParsers
        ),
        convertMet: convertMet(
          web3,
          chainId,
          explorer.logTransaction,
          metaParsers
        ),
        getExportMetFee: getExportMetFee(web3, chainId),
        estimateExportMetGas: over(estimateExportMetGas(web3, chainId)),
        estimateImportMetGas: over(estimateImportMetGas(web3, chainId)),
        exportMet: exportMet(
          web3,
          chainId,
          explorer.logTransaction,
          metaParsers
        ),
        getAuctionGasLimit: over(estimateAuctionGas(web3, chainId)),
        getConvertCoinEstimate: getCoinToMetEstimate(web3, chainId),
        getConvertCoinGasLimit: over(estimateCoinToMetGas(web3, chainId)),
        getConvertMetEstimate: getMetToMetEstimate(web3, chainId),
        getConvertMetGasLimit: over(estimateMetToCoinGas(web3, chainId)),
        importMet: importMet(
          web3,
          chainId,
          explorer.logTransaction,
          metaParsers
        ),
        sendMet: sendMet(
          web3,
          chainId,
          explorer.logTransaction,
          metaParsers
        )
      },
      events: [
        'auction-status-updated',
        'converter-status-updated',
        'attestation-threshold-updated',
        'wallet-error'
      ],
      name: 'metronome'
    }
  }

  function stop () {}

  return {
    start,
    stop
  }
}

module.exports = createPlugin
