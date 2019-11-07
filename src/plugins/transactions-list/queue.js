'use strict'

const { debounce, groupBy, merge, noop, reduce } = require('lodash')
const debug = require('debug')('metronome-wallet:core:explorer:queue')
const getTransactionStatus = require('./transaction-status')
const pDefer = require('p-defer')
const pRetry = require('p-retry')
const promiseAllProps = require('promise-all-props')

function createQueue(config, eventBus, plugins) {
  const metasCache = {}

  let pendingEvents = []
  let walletId

  function mergeEvents(hash, events) {
    const metas = events.map(({ event, metaParser }) => metaParser(event))

    metas.unshift(metasCache[hash] || {})

    metasCache[hash] = reduce(metas, merge)

    return metasCache[hash]
  }

  const mergeDones = events => events.map(event => event.done || noop)

  function fillInStatus({ transaction, receipt, meta }) {
    if (receipt && meta) {
      meta.contractCallFailed = !getTransactionStatus(transaction, receipt)
    }
    return { transaction, receipt, meta }
  }

  function emitTransactions(address, transactions) {
    debug('Emitting transactions')

    if (!walletId) {
      throw new Error('Wallet ID not set')
    }

    eventBus.emit('wallet-state-changed', {
      [walletId]: {
        addresses: {
          [address]: {
            transactions: transactions
              .filter(data => !!data.transaction)
              .map(fillInStatus)
          }
        }
      }
    })
    eventBus.emit('coin-tx')
  }

  function tryEmitTransactions(address, transactions) {
    debug('Trying to emit transactions')
    try {
      emitTransactions(address, transactions)
      return null
    } catch (err) {
      return err
    }
  }

  function retryExplorerCall(fn) {
    return pRetry(fn, {
      onFailedAttempt(err) {
        // Retry only 404 errors
        if (err.message.includes('404')) {
          debug('Retrying explorer call that ended in 404')
          return
        }
        debug('Explorer call failed with %s', err.message)
        throw err
      }
    })
  }

  function emitPendingEvents(address) {
    debug('About to emit pending events')

    const eventsToEmit = pendingEvents.filter(e => e.address === address)
    const eventsToKeep = pendingEvents.filter(e => e.address !== address)
    pendingEvents = eventsToKeep

    const grouped = groupBy(eventsToEmit, 'event.transactionHash')

    Promise.all(
      Object.keys(grouped).map(hash =>
        promiseAllProps({
          transaction: retryExplorerCall(() =>
            plugins.explorer.getTransaction(hash, true)
          ),
          receipt: retryExplorerCall(() =>
            plugins.explorer.getTransactionReceipt(hash, true)
          ),
          meta: mergeEvents(hash, grouped[hash]),
          done: mergeDones(grouped[hash])
        })
      )
    )
      .then(function(transactions) {
        const err = tryEmitTransactions(address, transactions)
        return Promise.all(
          transactions.map(transaction =>
            Promise.all(transaction.done.map(done => done(err)))
          )
        )
      })
      .catch(function(err) {
        debug('Something went wrong emitting events %s', err.message)
        eventBus.emit('wallet-error', {
          inner: err,
          message: 'Could not emit event transaction',
          meta: { plugin: 'explorer' }
        })
        eventsToEmit.forEach(function(event) {
          event.done(err)
        })
      })
  }

  const debouncedEmitPendingEvents = debounce(
    emitPendingEvents,
    config.explorerDebounce
  )

  const addTransaction = (address, meta) =>
    function(hash) {
      debug('Queueing transaction', hash)

      const deferred = pDefer()

      const event = {
        address,
        event: { transactionHash: hash },
        metaParser: () => meta || {},
        done: err => (err ? deferred.reject(err) : deferred.resolve())
      }
      pendingEvents.push(event)

      debouncedEmitPendingEvents(address)

      const promise = deferred.promise
      promise.catch(function(err) {
        debug('Some queued transactions failed: %s', err.message)
      })

      return { promise }
    }

  eventBus.on('open-wallets', function({ activeWallet }) {
    walletId = activeWallet
  })

  const addEvent = (address, metaParser) =>
    function(event) {
      debug('Queueing event', event.event)
      const deferred = pDefer()
      pendingEvents.push({
        address,
        event,
        metaParser,
        done: err => (err ? deferred.reject(err) : deferred.resolve())
      })
      debouncedEmitPendingEvents(address)
      return deferred.promise
    }

  return {
    addEvent,
    addTransaction
  }
}

module.exports = createQueue
