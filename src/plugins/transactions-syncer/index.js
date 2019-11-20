'use strict'

const { identity, isMatch, isNumber } = require('lodash')
const { toChecksumAddress } = require('web3-utils')
const debug = require('debug')('metronome-wallet:core:tx-syncer')
const pAll = require('p-all')
const pDefer = require('p-defer')

const createTryParseEventLog = require('./parse-log')
const createEventsRegistry = require('./events')

/**
 * Create the plugin.
 *
 * @returns {CorePlugin} The plugin.
 */
function createPlugin() {
  /**
   * Start the plugin.
   *
   * @param {CoreOptions} options The starting options.
   * @returns {CorePluginInterface} The plugin API.
   */
  function start({ config, eventBus, plugins }) {
    debug('Starting')

    const { displayName, symbol } = config
    const { coin, explorer, transactionsList } = plugins

    const emit = {
      walletError(message, err) {
        debug('Wallet error: %s', err.message)
        eventBus.emit('wallet-error', {
          inner: err,
          message,
          meta: { plugin: 'tx-syncer' }
        })
      }
    }

    const gotBestBlock = pDefer()
    const gotBestBlockPromise = gotBestBlock.promise

    let bestBlock

    const eventsRegistry = createEventsRegistry()

    function subscribeCoinTransactions(fromBlock, address) {
      let shallResync = false
      let resyncing = false
      let bestSyncBlock = fromBlock

      explorer
        .getTransactionStream(address)
        .on('data', transactionsList.addTransaction(address))
        .on('resync', function() {
          debug(`Shall resync ${symbol} transactions on next block`)
          shallResync = true
        })
        .on('error', function(err) {
          debug(`Shall resync ${symbol} transactions on next block`)
          shallResync = true
          emit.walletError(`Failed to sync ${displayName} transactions`, err)
        })

      // Check if should resync when a new block is seen, as that is the
      // indication of proper reconnection to the Ethereum node.
      eventBus.on('coin-block', function({ number }) {
        if (shallResync && !resyncing) {
          resyncing = true
          shallResync = false
          explorer
            .getTransactions(bestSyncBlock, number, address)
            .then(function(transactions) {
              const { length } = transactions
              debug(`${length} past ${symbol} transactions retrieved`)
              transactions.forEach(transactionsList.addTransaction(address))
              bestSyncBlock = number
              resyncing = false
            })
            .catch(function(err) {
              shallResync = true
              emit.walletError('Failed to resync transactions', err)
            })
        } else if (!resyncing) {
          bestSyncBlock = number
          bestBlock = number
        }
      })
    }

    function getPastCoinTransactions(fromBlock, toBlock, address) {
      return explorer
        .getTransactions(fromBlock, toBlock, address)
        .then(function(transactions) {
          debug(`${transactions.length} past ${symbol} transactions retrieved`)
          return Promise.all(
            transactions.map(transactionsList.addTransaction(address))
          ).then(() => toBlock)
        })
    }

    function getPastEvents(fromBlock, toBlock, address) {
      debug('Getting past events', address)
      return pAll(
        eventsRegistry
          .getAll()
          .map(function(registration) {
            const {
              contractAddress,
              abi,
              eventName,
              filter,
              metaParser,
              minBlock = 0
            } = registration(address)

            // TODO implement this in the explorer plugin
            // const contract = new web3.eth.Contract(abi, contractAddress)

            // // Ignore missing events
            // if (!contract.events[eventName]) {
            //   debug(`Could not get past events for ${eventName}`)
            //   return null
            // }

            return () =>
              explorer
                .getPastEvents(abi, contractAddress, eventName, {
                  fromBlock: Math.max(fromBlock, minBlock),
                  toBlock: Math.max(toBlock, minBlock),
                  filter
                })
                .then(function(events) {
                  debug(`${events.length} past ${eventName} events retrieved`)
                  return Promise.all(
                    events.map(transactionsList.addEvent(address, metaParser))
                  )
                })
          })
          .filter(identity),
        { concurrency: 5 }
      )
    }

    function refreshTransaction(hash, address) {
      debug('Refreshing %s', hash)
      return Promise.all([
        explorer.getTransactionReceipt(hash, address),
        coin.getHexAddress(address)
      ]).then(function([receipt, addressHex]) {
        const pending = []

        // Skip unconfirmed transactions
        if (!receipt || !isNumber(receipt.blockNumber)) {
          return pending
        }

        // Refresh transaction
        if (
          coin.toChecksumAddress(receipt.from) === address ||
          coin.toChecksumAddress(receipt.to) === address
        ) {
          debug('Pushing tx %s', hash)
          pending.push(transactionsList.addTransaction(address)(hash).promise)
        }

        // Refresh transaction events
        if (receipt.logs && receipt.logs.length) {
          const tryParseEventLog = createTryParseEventLog(eventsRegistry)

          receipt.logs.forEach(function(log) {
            const filterAddress = toChecksumAddress(addressHex)
            tryParseEventLog(log, filterAddress).forEach(function(parsedLog) {
              const {
                contractAddress,
                eventAbi,
                filter,
                metaParser,
                parsed: { event, returnValues }
              } = parsedLog

              if (isMatch(returnValues, filter)) {
                debug('Pushing event %s of tx %s', event, hash)
                pending.push(
                  transactionsList.addEvent(
                    address,
                    metaParser
                  )({
                    address: contractAddress,
                    event,
                    returnValues: coin.parseReturnValues(
                    returnValues,
                      eventAbi
                    ),
                    transactionHash: hash
                  })
                )
              }
            })
          })
        }

        debug('Waiting on pending txs')
        return Promise.all(pending)
      })
    }

    function refreshAllTransactions(address) {
      return gotBestBlockPromise.then(() =>
        Promise.all([
          getPastCoinTransactions(0, bestBlock, address),
          getPastEvents(0, bestBlock, address)
        ]).then(function([syncedBlock]) {
          bestBlock = syncedBlock
          return syncedBlock
        })
      )
    }

    // TODO fix
    function subscribeEvents(fromBlock, address) {
      eventsRegistry.getAll().forEach(function(registration) {
        let shallResync = false
        let resyncing = false
        let bestSyncBlock = fromBlock

        const {
          contractAddress,
          abi,
          eventName,
          filter,
          metaParser
        } = registration(address)

        // TODO implement this in the explorer plugin
        // const contract = new web3.eth.Contract(abi, contractAddress)

        // // Ignore missing events
        // if (!contract.events[eventName]) {
        //   debug('Could not subscribe: event not found', eventName)
        //   return
        // }

        // Get past events and subscribe to incoming events
        // const emitter = contract.events[eventName]({ fromBlock, filter })
        //   .on('data', transactionsList.addEvent(address, metaParser))
        //   .on('changed', transactionsList.addEvent(address, metaParser))
        //   .on('error', function(err) {
        //     debug('Shall resync events on next block')
        //     shallResync = true
        //     eventBus.emit('wallet-error', {
        //       inner: err,
        //       message: `Subscription to event ${eventName} failed`,
        //       meta: { plugin: 'explorer' }
        //     })
        //   })

        // subscriptions.push(emitter)

        // Resync on new block or save it as best sync block
        eventBus.on('coin-block', function({ number }) {
          if (shallResync && !resyncing) {
            resyncing = true
            shallResync = false

            // eslint-disable-next-line promise/catch-or-return
            explorer
              .getPastEvents(abi, contractAddress, eventName, {
                fromBlock: bestSyncBlock,
                filter
              })
              .then(function(events) {
                debug(`${events.length} past ${eventName} events retrieved`)
                events.forEach(transactionsList.addEvent(address, metaParser))
              })
              .catch(function(err) {
                shallResync = true
                eventBus.emit('wallet-error', {
                  inner: err,
                  message: `Failed to resync event ${eventName}`,
                  meta: { plugin: 'explorer' }
                })
              })
              .then(function() {
                resyncing = false
              })
          } else if (!resyncing) {
            bestSyncBlock = number
            bestBlock = number
          }
        })
      })
    }

    function syncTransactions(fromBlock, address) {
      return gotBestBlockPromise
        .then(function() {
          debug('Syncing', fromBlock, bestBlock)
          subscribeCoinTransactions(bestBlock, address)
          subscribeEvents(bestBlock, address)
          return Promise.all([
            getPastCoinTransactions(fromBlock, bestBlock, address),
            getPastEvents(fromBlock, bestBlock, address)
          ])
        })
        .then(function([syncedBlock]) {
          bestBlock = syncedBlock
          return syncedBlock
        })
    }

    eventBus.once('coin-block', function(header) {
      debug('Got best block', header.number)
      bestBlock = header.number
      gotBestBlock.resolve(header.number)
    })

    return {
      api: {
        getPastCoinTransactions,
        getPastEvents,
        registerEvent: eventsRegistry.register,
        refreshTransaction,
        refreshAllTransactions,
        syncTransactions
      },
      events: ['wallet-error'],
      name: 'transactionsSyncer'
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
