'use strict'

const debug = require('debug')('met-wallet:core:explorer')
const pDefer = require('p-defer')
const Web3 = require('web3')

const createEventsRegistry = require('./events')
const createQueue = require('./queue')
const createStream = require('./blocks-stream')
const createTransactionSyncer = require('./sync-transactions')
const createIndexer = require('./indexer')
const refreshTransaction = require('./refresh-transactions')
const tryParseEventLog = require('./parse-log')

function createPlugin () {
  let blocksStream
  let indexer
  let syncer

  function start ({ config, eventBus, plugins }) {
    debug.enabled = config.debug

    const web3 = new Web3(plugins.eth.web3Provider)

    const eventsRegistry = createEventsRegistry()
    const queue = createQueue(config, eventBus, web3)

    indexer = createIndexer(config)

    syncer = createTransactionSyncer(
      config,
      eventBus,
      web3,
      queue,
      eventsRegistry,
      indexer
    )

    debug('Initiating blocks stream')
    blocksStream = createStream(web3)
    blocksStream.on('data', function (header) {
      debug('New block', header.number, header.hash)
      eventBus.emit('coin-block', header)
    })
    blocksStream.on('error', function (err) {
      debug('Could not get lastest block')
      eventBus.emit('wallet-error', {
        inner: err,
        message: 'Could not get lastest block',
        meta: { plugin: 'explorer' }
      })
    })

    function logTransaction (promiEvent, from, meta) {
      // PromiEvent objects shall be wrapped to avoid the promise chain to
      // cast it to a plain promise
      if (promiEvent.once) {
        const deferred = pDefer()

        promiEvent.once('transactionHash', function (hash) {
          queue.addTransaction(from, meta)(hash)
        })
        promiEvent.once('receipt', function (receipt) {
          queue.addTransaction(from)(receipt.transactionHash)
          deferred.resolve({ receipt })
        })
        promiEvent.once('error', function (err) {
          promiEvent.removeAllListeners()
          deferred.reject(err)
        })

        return deferred.promise
      }

      // This is not a wrapped PromiEvent object. It shall be a plain promise
      // instead.
      const promise = promiEvent
      return promise.then(function (receipt) {
        queue.addTransaction(from)(receipt.transactionHash)
        return { receipt }
      })
    }

    return {
      api: {
        logTransaction,
        refreshAllTransactions: syncer.refreshAllTransactions,
        refreshTransaction: refreshTransaction(web3, eventsRegistry, queue),
        registerEvent: eventsRegistry.register,
        syncTransactions: syncer.syncTransactions,
        tryParseEventLog: tryParseEventLog(web3, eventsRegistry)
      },
      events: [
        'coin-block',
        'wallet-error'
      ],
      name: 'explorer'
    }
  }

  function stop () {
    blocksStream.destroy()
    indexer.disconnect()
    syncer.stop()
  }

  return {
    start,
    stop
  }
}

module.exports = createPlugin
