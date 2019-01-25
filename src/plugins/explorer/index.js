'use strict'

const { debounce, groupBy, isMatch, merge, noop, reduce } = require('lodash')
const debug = require('debug')('met-wallet:core:explorer')
const pDefer = require('p-defer')
const promiseAllProps = require('promise-all-props')
const Web3 = require('web3')

const createStream = require('./blocks-stream')
const indexer = require('./indexer')

function create () {
  function markFailedTransaction ({ transaction, receipt, meta }) {
    if (receipt && meta) {
      meta.contractCallFailed = receipt.status === false || (
        receipt.status === null && // no Byzantinum fork
        transaction.input !== '0x' && // is contract call
        transaction.gas === receipt.gasUsed && // used all gas
        !receipt.logs.length // and no any logs
      )
    }

    return { transaction, receipt, meta }
  }

  let blocksStream
  let bestBlock

  function start ({ config, eventBus, plugins }) {
    debug.enabled = config.debug

    const web3 = new Web3(plugins.eth.web3Provider)

    function getAndEmitBlock () {
      debug('Getting latest block')
      return web3.eth.getBlock('latest')
        .then(function (block) {
          debug('Latest block', block.number, block.hash)
          bestBlock = block.number
          eventBus.emit('coin-block', block)
        })
        .catch(function (err) {
          debug('Could not get lastest block')
          eventBus.emit('wallet-error', {
            inner: err,
            message: 'Could not get lastest block',
            meta: { plugin: 'explorer' }
          })
        })
    }

    const started = getAndEmitBlock()

    blocksStream = createStream(web3)

    let intervalId

    blocksStream.on('data', function (header) {
      clearInterval(intervalId)

      debug('New block', header.number, header.hash)
      bestBlock = header.number
      eventBus.emit('coin-block', header)

      intervalId = setInterval(function () {
        debug('No blocks received. Probing connection...')
        getAndEmitBlock()
      }, 120000)
    })

    blocksStream.on('error', function (err) {
      eventBus.emit('wallet-error', {
        inner: err,
        message: 'Block headers subscription failed',
        meta: { plugin: 'explorer' }
      })
    })

    let pendingEvents = []

    let walletId

    eventBus.on('open-wallets', function ({ activeWallet }) {
      walletId = activeWallet
    })

    const metasCache = {}

    function mergeEvents (hash, events) {
      const metas = events.map(({ event, metaParser }) => metaParser(event))

      metas.unshift(metasCache[hash] || {})

      metasCache[hash] = reduce(metas, merge)

      return metasCache[hash]
    }

    function mergeDones (events) {
      return events.map(event => event.done || noop)
    }

    function emitTransactions (address, transactions) {
      if (!walletId) {
        throw new Error('Wallet ID not set')
      }

      eventBus.emit('wallet-state-changed', {
        [walletId]: {
          addresses: {
            [address]: {
              transactions: transactions.map(markFailedTransaction)
            }
          }
        }
      })
      eventBus.emit('coin-tx')
    }

    function tryEmitTransactions (address, transactions) {
      try {
        emitTransactions(address, transactions)
        return null
      } catch (err) {
        return err
      }
    }

    function emitPendingEvents (address) {
      debug('About to emit pending events')

      const eventsToEmit = pendingEvents.filter(e => e.address === address)
      const eventsToKeep = pendingEvents.filter(e => e.address !== address)
      pendingEvents = eventsToKeep

      const grouped = (groupBy(eventsToEmit, 'event.transactionHash'))

      Promise.all(Object.keys(grouped).map(hash => promiseAllProps({
        transaction: web3.eth.getTransaction(hash),
        receipt: web3.eth.getTransactionReceipt(hash),
        meta: mergeEvents(hash, grouped[hash]),
        done: mergeDones(grouped[hash])
      })))
        .then(function (transactions) {
          const err = tryEmitTransactions(address, transactions)
          return Promise.all(transactions.map(transaction =>
            Promise.all(transaction.done.map(done =>
              done(err)
            ))
          ))
        })
        .catch(function (err) {
          eventBus.emit('wallet-error', {
            inner: err,
            message: 'Could not emit event transaction',
            meta: { plugin: 'explorer' }
          })
          eventsToEmit.forEach(function (event) {
            event.done(err)
          })
        })
    }

    const debouncedEmitPendingEvents = debounce(
      emitPendingEvents,
      config.explorerDebounce
    )

    const queueAndEmitEvent = (address, metaParser) => function (event) {
      debug('Queueing event', event.event)
      const deferred = pDefer()
      pendingEvents.push({
        address,
        event,
        metaParser,
        done: err => err ? deferred.reject(err) : deferred.resolve()
      })
      debouncedEmitPendingEvents(address)
      return deferred.promise
    }

    const queueAndEmitTransaction = (address, meta) => function (hash) {
      debug('Queueing transaction', hash)
      const deferred = pDefer()
      pendingEvents.push({
        address,
        event: { transactionHash: hash },
        metaParser: () => (meta || {}),
        done: err => err ? deferred.reject(err) : deferred.resolve()
      })
      debouncedEmitPendingEvents(address)
      return deferred.promise
    }

    const registeredEvents = []

    function registerEvent (registration) {
      registeredEvents.push(registration)
    }

    function subscribeEvents (fromBlock, address) {
      registeredEvents.forEach(function (registration) {
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
        contract.events[eventName]({ fromBlock, filter })
          .on('data', queueAndEmitEvent(address, metaParser))
          .on('changed', queueAndEmitEvent(address, metaParser))
          .on('error', function (err) {
            debug('Shall resync events on next block')
            shallResync = true
            eventBus.emit('wallet-error', {
              inner: err,
              message: `Subscription to event ${eventName} failed`,
              meta: { plugin: 'explorer' }
            })
          })

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
                events.forEach(queueAndEmitEvent(address, metaParser))
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

    function getPastEvents (fromBlock, toBlock, address) {
      return Promise.all(registeredEvents.map(function (registration) {
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
              events.map(queueAndEmitEvent(address, metaParser))
            ).then(noop)
          })
      }))
    }

    function subscribeCoinTransactions (fromBlock, address) {
      let shallResync = false
      let bestSyncBlock = fromBlock

      const { chainId, symbol } = config
      const {
        getTransactions,
        getTransactionStream
      } = indexer(config)

      getTransactionStream(address)
        .on('data', queueAndEmitTransaction(address))
        .on('resync', function () {
          debug(`Shall resync ${symbol} transactions on next block`)
          shallResync = true
        })
        .on('error', function (err) {
          debug(`Shall resync ${symbol} transactions on next block`)
          shallResync = true
          eventBus.emit('wallet-error', {
            inner: err,
            message: `Failed to sync transactions (chainId: ${chainId})`,
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
              transactions.forEach(queueAndEmitTransaction(address))
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
          return Promise.all(transactions.map(queueAndEmitTransaction(address)))
            .then(noop)
        })
    }

    function syncTransactions (fromBlock, address) {
      return started
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
        .then(([best]) => best)
    }

    function logTransaction (promiEvent, from, meta) {
      // PromiEvent objects shall be wrapped to avoid the promise chain to
      // cast it to a plain promise
      if (promiEvent.once) {
        const deferred = pDefer()

        promiEvent.once('transactionHash', function (hash) {
          queueAndEmitTransaction(from, meta)(hash)
        })
        promiEvent.once('receipt', function (receipt) {
          queueAndEmitTransaction(from)(receipt.transactionHash)
          eventBus.emit('coin-tx')
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
        queueAndEmitTransaction(from)(receipt.transactionHash)
        eventBus.emit('coin-tx')
        return { receipt }
      })
    }

    function tryParseEventLog (log, walletAddress) {
      return registeredEvents
        .map(function (registration) {
          const {
            abi,
            contractAddress,
            eventName,
            filter,
            metaParser
          } = registration(walletAddress)

          const eventAbi = abi.find(e =>
            e.type === 'event' && e.name === eventName
          )
          const signature = web3.eth.abi.encodeEventSignature(eventAbi)

          if (log.address !== contractAddress ||
            log.raw.topics[0] !== signature
          ) {
            return null
          }

          const returnValues = web3.eth.abi.decodeLog(
            eventAbi.inputs,
            log.raw.data,
            eventAbi.anonymous ? log.raw.topics : log.raw.topics.slice(1)
          )

          return {
            filter,
            metaParser,
            parsed: Object.assign({}, log, {
              event: eventName,
              returnValues,
              signature
            })
          }
        })
        .find(data => !!data)
    }

    function refreshTransaction (hash, address) {
      return web3.eth.getTransactionReceipt(hash)
        .then(function (receipt) {
          // Skip unconfirmed transactions
          if (!receipt) {
            return Promise.resolve()
          }

          const pending = []

          // Refresh transaction
          if (web3.utils.toChecksumAddress(receipt.from) === address ||
            web3.utils.toChecksumAddress(receipt.to) === address) {
            pending.push(queueAndEmitTransaction(address)(hash))
          }

          // Refresh transaction events
          if (receipt.logs && receipt.logs.length) {
            registeredEvents.forEach(function (registration) {
              const {
                contractAddress,
                abi,
                eventName,
                filter,
                metaParser
              } = registration(address)

              const eventAbi = abi.find(e =>
                e.type === 'event' && e.name === eventName
              )
              const signature = web3.eth.abi.encodeEventSignature(eventAbi)

              receipt.logs.forEach(function (event) {
                if (event.address === contractAddress &&
                  event.topics[0] === signature) {
                  const returnValues = web3.eth.abi.decodeLog(
                    eventAbi.inputs,
                    event.data,
                    eventAbi.anonymous ? event.topics : event.topics.slice(1)
                  )
                  if (isMatch(returnValues, filter)) {
                    pending.push(queueAndEmitEvent(address, metaParser)({
                      address: contractAddress,
                      event: eventName,
                      returnValues,
                      transactionHash: hash
                    }))
                  }
                }
              })
            })
          }

          return Promise.all(pending)
            .then(noop)
        })
    }

    function refreshAllTransactions (address) {
      return Promise.all([
        getPastCoinTransactions(0, bestBlock, address),
        getPastEvents(0, bestBlock, address)
      ])
    }

    return {
      api: {
        logTransaction,
        refreshAllTransactions,
        refreshTransaction,
        registerEvent,
        syncTransactions,
        tryParseEventLog
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
  }

  return { start, stop }
}

module.exports = {
  create
}
