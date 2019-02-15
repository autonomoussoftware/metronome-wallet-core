'use strict'

const debug = require('debug')('met-wallet:core:explorer')
const Web3 = require('web3')

const createEventsRegistry = require('./events')
const createIndexer = require('./indexer')
const createLogTransaction = require('./log-transaction')
const createQueue = require('./queue')
const createStream = require('./blocks-stream')
const createTransactionSyncer = require('./sync-transactions')
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

    indexer = createIndexer(config, eventBus)

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
    blocksStream.on('data', function ({ hash, number, timestamp }) {
      debug('New block', hash, number)
      eventBus.emit('coin-block', { hash, number, timestamp })
    })
    blocksStream.on('error', function (err) {
      debug('Could not get lastest block')
      eventBus.emit('wallet-error', {
        inner: err,
        message: 'Could not get lastest block',
        meta: { plugin: 'explorer' }
      })
    })

    return {
      api: {
        logTransaction: createLogTransaction(queue),
        refreshAllTransactions: syncer.refreshAllTransactions,
        refreshTransaction: refreshTransaction(web3, eventsRegistry, queue),
        registerEvent: eventsRegistry.register,
        syncTransactions: syncer.syncTransactions,
        tryParseEventLog: tryParseEventLog(web3, eventsRegistry)
      },
      events: [
        'coin-block',
        'indexer-connection-status-changed',
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
