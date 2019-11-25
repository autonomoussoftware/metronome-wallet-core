'use strict'

const { createMetronome, createProvider } = require('metronome-sdk')
const metSdk = require('metronome-sdk')
// const MetronomeContracts = require('metronome-contracts')

const { buyMet } = require('./auction-api')
// const {
//   convertCoin,
//   convertMet,
//   estimateCoinToMetGas,
//   estimateMetToCoinGas,
//   getCoinToMetEstimate,
//   getMetToMetEstimate
// } = require('./converter-api')
// const { getExportMetFee, getMerkleRoot } = require('./porter-api')
const {
  //   estimateExportMetGas,
  //   estimateImportMetGas,
  //   exportMet,
  //   importMet,
  sendMet
} = require('./token-api')
const auctionEvents = require('./auction-events')
// const converterEvents = require('./converter-events')
// const getAttestationThreshold = require('./validator-status')
// const getChainHopStartTime = require('./porter-status')
// const porterEvents = require('./porter-events')
// const validatorEvents = require('./validator-events')

/**
 * Creates an instance of the Metronome plugin.
 *
 * @returns {{start:Function,stop:Function}} The plugin top-level API.
 */
function createPlugin() {
  /**
   * Start the plugin.
   *
   * @param {object} params The start parameters.
   * @param {object} params.config The configuration options.
   * @param {object} params.eventBus The cross-plugin event emitter.
   * @param {object} params.plugins All other plugins.
   * @returns {{api:object,events:string[],name:string}} The plugin API.
   */
  function start({ config, eventBus, plugins }) {
    const { erc20, coin, tokensBalance, transactionsList, wallet } = plugins
    const { chainId, chainType } = config
    const { transactionsSyncer } = plugins

    const metProvider = createProvider.fromLib(coin.lib)
    const met = createMetronome(metProvider)

    function withMetContracts(fn) {
      const metContractsPromise = met.getContracts()
      return metContractsPromise.then(fn)
    }

    // Register MET token
    withMetContracts(function({ METToken }) {
      tokensBalance.registerToken(METToken.options.address, {
        decimals: 18,
        name: 'Metronome',
        symbol: 'MET'
      })
    }).catch(function(err) {
      // TODO emit wallet error
      console.log('Could not register token', err.message)
    })

    // Register all MET events
    const metContracts = metSdk.getContracts(chainType, chainId)
    ;[]
      .concat(auctionEvents.getEventDataCreator(metContracts))
      //   .concat(converterEvents.getEventDataCreator(metContracts))
      //   .concat(porterEvents.getEventDataCreator(metContracts))
      //   .concat(validatorEvents.getEventDataCreator(metContracts))
      .forEach(transactionsSyncer.registerEvent)

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
          .then(function(status) {
            eventBus.emit('auction-status-updated', status)
          }),
        met
          .getConverterStatus()
          .then(({ currentConverterPrice, ethBalance, metBalance }) => ({
            availableMet: metBalance,
            availableCoin: ethBalance,
            currentPrice: currentConverterPrice
          }))
          .then(function(status) {
            eventBus.emit('converter-status-updated', status)
          })
        // getAttestationThreshold(web3, chainId).then(function (status) {
        //   eventBus.emit('attestation-threshold-updated', status)
        // }),
        // getChainHopStartTime(web3, chainId).then(function (status) {
        //   eventBus.emit('chain-hop-start-time-updated', status)
        // })
      ]).catch(function(err) {
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
        auction: auctionEvents.auctionMetaParser
        //     converter: converterEvents.converterMetaParser,
        //     export: porterEvents.exportMetaParser,
        //     import: porterEvents.importMetaParser,
        //     importRequest: porterEvents.importRequestMetaParser
      },
      erc20.metaParsers
    )

    // Define gas over-estimation wrapper
    // const over = fn => (...args) =>
    //   fn(...args).then(gas => ({
    //     gasLimit: Math.round(gas * gasOverestimation)
    //   }))

    // Build and return API
    return {
      api: {
        getContractAddress: name =>
          withMetContracts(contracts => contracts[name].options.address),
        buyMetronome: buyMet(
          wallet.getSigningLib,
          transactionsList.logTransaction,
          metaParsers
        ),
        // convertCoin: convertCoin(
        //   web3,
        //   chainId,
        //   transactionsList.logTransaction,
        //   metaParsers
        // ),
        // convertMet: convertMet(
        //   web3,
        //   chainId,
        //   transactionsList.logTransaction,
        //   metaParsers
        // ),
        // getExportMetFee: getExportMetFee(web3, chainId),
        // getMerkleRoot: getMerkleRoot(web3, chainId),
        // estimateExportMetGas: over(estimateExportMetGas(web3, chainId)),
        // estimateImportMetGas: over(estimateImportMetGas(web3, chainId)),
        // exportMet: exportMet(
        //   web3,
        //   chainId,
        //   transactionsList.logTransaction,
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
        //   transactionsList.logTransaction,
        //   metaParsers
        // ),
        // getSendMetGasLimit: // TODO
        sendMet: sendMet(
          wallet.getSigningLib,
          transactionsList.logTransaction,
          metaParsers
        )
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
  function stop() {}

  return {
    start,
    stop
  }
}

module.exports = createPlugin
