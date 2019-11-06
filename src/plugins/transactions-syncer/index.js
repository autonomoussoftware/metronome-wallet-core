'use strict'

const debug = require('debug')('metronome-wallet:core:tx-syncer')
const pDefer = require('p-defer')

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
    const { explorer, transactionsList } = plugins

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
    // let bestBlock

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
          // bestBlock = number
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

    function syncTransactions(fromBlock, address) {
      return gotBestBlockPromise
        .then(function(bestBlock) {
          debug('Syncing', fromBlock, bestBlock)
          subscribeCoinTransactions(bestBlock, address)
          // subscribeEvents(bestBlock, address)
          return Promise.all([
            getPastCoinTransactions(fromBlock, bestBlock, address)
            // getPastEvents(fromBlock, bestBlock, address)
          ])
        })
        .then(function([syncedBlock]) {
          // bestBlock = syncedBlock
          return syncedBlock
        })
    }

    eventBus.once('coin-block', function(header) {
      debug('Got best block', header.number)
      // bestBlock = header.number
      gotBestBlock.resolve(header.number)
    })

    return {
      api: {
        getPastCoinTransactions,
        // getPastEvents,
        // refreshAllTransactions,
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
