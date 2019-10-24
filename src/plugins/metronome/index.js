'use strict'

const { createMetronome, createProvider } = require('metronome-sdk')
const { toChecksumAddress } = require('web3-utils')
// const MetronomeContracts = require('metronome-contracts')

// const { buyMet, estimateAuctionGas } = require('./auction-api')
// const {
//   convertCoin,
//   convertMet,
//   estimateCoinToMetGas,
//   estimateMetToCoinGas,
//   getCoinToMetEstimate,
//   getMetToMetEstimate
// } = require('./converter-api')
// const { getExportMetFee, getMerkleRoot } = require('./porter-api')
// const {
//   estimateExportMetGas,
//   estimateImportMetGas,
//   exportMet,
//   importMet,
//   sendMet
// } = require('./token-api')
// const auctionEvents = require('./auction-events')
// const converterEvents = require('./converter-events')
// const getAttestationThreshold = require('./validator-status')
// const getAuctionStatus = require('./auction-status')
// const getChainHopStartTime = require('./porter-status')
// const getConverterStatus = require('./converter-status')
// const porterEvents = require('./porter-events')
// const validatorEvents = require('./validator-events')

/**
 * Creates an instance of the Metronome plugin.
 *
 * @returns {{start:Function,stop:Function}} The plugin top-level API.
 */
function createPlugin () {
  /**
   * Start the plugin.
   *
   * @param {object} params The start parameters.
   * @param {object} params.config The configuration options.
   * @param {object} params.eventBus The cross-plugin event emitter.
   * @param {object} params.plugins All other plugins.
   * @returns {{api:object,events:string[],name:string}} The plugin API.
   */
  function start ({ config, eventBus, plugins }) {
    const { chainType } = config
    const { eth, qtum, tokens } = plugins
    // const { chainId, chainType, gasOverestimation } = config
    // const { eth, explorer, qtum, tokens } = plugins

    let metProvider
    if (chainType === 'ethereum') {
      metProvider = createProvider.fromWeb3(eth.web3)
    } else if (chainType === 'qtum') {
      metProvider = createProvider.fromQtumRPC({ qtumRPC: qtum.qtumRPC })
    }
    const met = createMetronome(metProvider)

    // Register MET token
    metProvider
      .getContracts()
      .then(function ({ METToken }) {
        tokens.registerToken(toChecksumAddress(METToken.options.address), {
          decimals: 18,
          name: 'Metronome',
          symbol: 'MET'
        })
      })
      .catch(function (err) {
        // TODO
        console.log(err)
      })

    // Register all MET events
    // const events = []
    // events
    //   .concat(auctionEvents.getEventDataCreator(chainId))
    //   .concat(converterEvents.getEventDataCreator(chainId))
    //   .concat(porterEvents.getEventDataCreator(chainId))
    //   .concat(validatorEvents.getEventDataCreator(chainId))
    //   .forEach(explorer.registerEvent)

    // Start emitting MET status
    const emitMetronomeStatus = () =>
      Promise.all([
        met
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
          .then(function (status) {
            eventBus.emit('auction-status-updated', status)
          }),
        met
          .getConverterStatus()
          .then(({ currentConverterPrice, ethBalance, metBalance }) => ({
            availableMet: metBalance,
            availableCoin: ethBalance,
            currentPrice: currentConverterPrice
          }))
          .then(function (status) {
            eventBus.emit('converter-status-updated', status)
          })
        // getAttestationThreshold(web3, chainId).then(function (status) {
        //   eventBus.emit('attestation-threshold-updated', status)
        // }),
        // getChainHopStartTime(web3, chainId).then(function (status) {
        //   eventBus.emit('chain-hop-start-time-updated', status)
        // })
      ]).catch(function (err) {
        eventBus.emit('wallet-error', {
          inner: err,
          message: 'Metronome status could not be retrieved',
          meta: { plugin: 'metronome' }
        })
      })

    emitMetronomeStatus()

    eventBus.on('coin-block', emitMetronomeStatus)

    // Collect meta parsers
    // const metaParsers = Object.assign(
    //   {
    //     auction: auctionEvents.auctionMetaParser,
    //     converter: converterEvents.converterMetaParser,
    //     export: porterEvents.exportMetaParser,
    //     import: porterEvents.importMetaParser,
    //     importRequest: porterEvents.importRequestMetaParser
    //   },
    //   tokens.metaParsers
    // )

    // Define gas over-estimation wrapper
    // const over = fn => (...args) =>
    //   fn(...args).then(gas => ({
    //     gasLimit: Math.round(gas * gasOverestimation)
    //   }))

    // Build and return API
    return {
      api: {
        // buyMetronome: buyMet(
        //   web3,
        //   chainId,
        //   explorer.logTransaction,
        //   metaParsers
        // ),
        // convertCoin: convertCoin(
        //   web3,
        //   chainId,
        //   explorer.logTransaction,
        //   metaParsers
        // ),
        // convertMet: convertMet(
        //   web3,
        //   chainId,
        //   explorer.logTransaction,
        //   metaParsers
        // ),
        // getExportMetFee: getExportMetFee(web3, chainId),
        // getMerkleRoot: getMerkleRoot(web3, chainId),
        // estimateExportMetGas: over(estimateExportMetGas(web3, chainId)),
        // estimateImportMetGas: over(estimateImportMetGas(web3, chainId)),
        // exportMet: exportMet(
        //   web3,
        //   chainId,
        //   explorer.logTransaction,
        //   metaParsers
        // ),
        // getAuctionGasLimit: over(estimateAuctionGas(web3, chainId)),
        // getConvertCoinEstimate: getCoinToMetEstimate(web3, chainId),
        // getConvertCoinGasLimit: over(estimateCoinToMetGas(web3, chainId)),
        // getConvertMetEstimate: getMetToMetEstimate(web3, chainId),
        // getConvertMetGasLimit: over(estimateMetToCoinGas(web3, chainId)),
        // importMet: importMet(
        //   web3,
        //   chainId,
        //   explorer.logTransaction,
        //   metaParsers
        // ),
        // sendMet: sendMet(web3, chainId, explorer.logTransaction, metaParsers)
      },
      events: [
        'attestation-threshold-updated',
        'auction-status-updated',
        'chain-hop-start-time-updated',
        'converter-status-updated',
        'wallet-error'
      ],
      name: 'metronome'
    }
  }

  /**
   * Stop the plugin.
   */
  function stop () {}

  return {
    start,
    stop
  }
}

module.exports = createPlugin
