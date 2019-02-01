'use strict'

const debug = require('debug')('met-wallet:core:explorer:syncer')
const pDefer = require('p-defer')

const indexer = require('./indexer')

// eslint-disable-next-line max-params
function createSyncer (config, eventBus, web3, queue, eventsRegistry) {
  debug.enabled = config.debug

  const deferred = pDefer()
  const gotBestBlockPromise = deferred.promise

  let bestBlock

  eventBus.once('coin-block', function (header) {
    bestBlock = header.number
    debug('Got best block', bestBlock)
    deferred.resolve()
  })

  function subscribeCoinTransactions (fromBlock, address) {
    let shallResync = false
    let bestSyncBlock = fromBlock

    const { symbol, displayName } = config
    const {
      getTransactions,
      getTransactionStream
    } = indexer(config)

    getTransactionStream(address)
      .on('data', queue.addTransaction(address))
      .on('resync', function () {
        debug(`Shall resync ${symbol} transactions on next block`)
        shallResync = true
      })
      .on('error', function (err) {
        debug(`Shall resync ${symbol} transactions on next block`)
        shallResync = true
        eventBus.emit('wallet-error', {
          inner: err,
          message: `Failed to sync ${displayName} transactions`,
          meta: { plugin: 'explorer' }
        })
      })

    // Check if shall resync when a new block is seen, as that is the
    // indication of proper reconnection to the Ethereum node.
    eventBus.on('coin-block', function ({ number }) {
      if (shallResync) {
        shallResync = false
        getTransactions(bestSyncBlock, number, address)
          .then(function (transactions) {
            const { length } = transactions
            debug(`${length} past ${symbol} transactions retrieved`)
            transactions.forEach(queue.addTransaction(address))
            bestSyncBlock = number
          })
          .catch(function (err) {
            shallResync = true
            eventBus.emit('wallet-error', {
              inner: err,
              message: 'Failed to resync transactions',
              meta: { plugin: 'explorer' }
            })
          })
      }
    })
  }

  function getPastCoinTransactions (fromBlock, toBlock, address) {
    const { symbol } = config
    const { getTransactions } = indexer(config)

    return getTransactions(fromBlock, toBlock, address)
      .then(function (transactions) {
        debug(`${transactions.length} past ${symbol} transactions retrieved`)
        return Promise.all(transactions.map(queue.addTransaction(address)))
      })
  }

  const getPastEvents = (fromBlock, toBlock, address) =>
    Promise.all(eventsRegistry.getAll().map(function (registration) {
      const {
        contractAddress,
        abi,
        eventName,
        filter,
        metaParser,
        minBlock = 0
      } = registration(address)

      const contract = new web3.eth.Contract(abi, contractAddress)

      // Ignore missing events
      if (!contract.events[eventName]) {
        debug(`Could not get past events for ${eventName}`)
        return Promise.resolve()
      }

      return contract.getPastEvents(eventName, {
        fromBlock: Math.max(fromBlock, minBlock),
        toBlock: Math.max(toBlock, minBlock),
        filter
      })
        .then(function (events) {
          debug(`${events.length} past ${eventName} events retrieved`)
          return Promise.all(
            events.map(queue.addEvent(address, metaParser))
          )
        })
    }))

  const subscriptions = []

  function subscribeEvents (fromBlock, address) {
    eventsRegistry.getAll().forEach(function (registration) {
      let shallResync = false
      let bestSyncBlock = fromBlock

      const {
        contractAddress,
        abi,
        eventName,
        filter,
        metaParser
      } = registration(address)

      const contract = new web3.eth.Contract(abi, contractAddress)

      // Ignore missing events
      if (!contract.events[eventName]) {
        debug('Could not subscribe: event not found', eventName)
        return
      }

      // Get past events and subscribe to incoming events
      const emitter = contract.events[eventName]({ fromBlock, filter })
        .on('data', queue.addEvent(address, metaParser))
        .on('changed', queue.addEvent(address, metaParser))
        .on('error', function (err) {
          debug('Shall resync events on next block')
          shallResync = true
          eventBus.emit('wallet-error', {
            inner: err,
            message: `Subscription to event ${eventName} failed`,
            meta: { plugin: 'explorer' }
          })
        })
      subscriptions.push(emitter)

      // Resync on new block or save it as best sync block
      eventBus.on('coin-block', function ({ number }) {
        if (shallResync) {
          shallResync = false
          contract.getPastEvents(
            eventName,
            { fromBlock: bestSyncBlock, filter }
          )
            .then(function (events) {
              debug(`${events.length} past ${eventName} events retrieved`)
              events.forEach(queue.addEvent(address, metaParser))
            })
            .catch(function (err) {
              shallResync = true
              eventBus.emit('wallet-error', {
                inner: err,
                message: `Failed to resync event ${eventName}`,
                meta: { plugin: 'explorer' }
              })
            })
        } else {
          bestSyncBlock = number
        }
      })
    })
  }

  const syncTransactions = (fromBlock, address) =>
    gotBestBlockPromise
      .then(function () {
        debug('Syncing', fromBlock, bestBlock)
        subscribeCoinTransactions(bestBlock, address)
        subscribeEvents(bestBlock, address)
        return Promise.all([
          bestBlock,
          getPastCoinTransactions(fromBlock, bestBlock, address),
          getPastEvents(fromBlock, bestBlock, address)
        ])
      })
      .then(([syncedBlock]) => syncedBlock)

  const refreshAllTransactions = address =>
    gotBestBlockPromise
      .then(() =>
        Promise.all([
          getPastCoinTransactions(0, bestBlock, address),
          getPastEvents(0, bestBlock, address)
        ])
      )

  function stop () {
    subscriptions.forEach(function (subscription) {
      subscription.unsubscribe(function (err) {
        if (err) {
          debug('Could not unsubscribe from event', err.message)
        }
      })
    })
  }

  return {
    getPastCoinTransactions,
    getPastEvents,
    refreshAllTransactions,
    stop,
    syncTransactions
  }
}

module.exports = createSyncer
