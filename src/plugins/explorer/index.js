'use strict'

const { debounce, groupBy, isMatch, merge, noop, reduce } = require('lodash')
const debug = require('debug')('met-wallet:core:explorer')
const pDefer = require('p-defer')
const promiseAllProps = require('promise-all-props')
const Web3 = require('web3')

const createStream = require('./blocks-stream')
const indexer = require('./indexer')

function markFailedTransaction ({ transaction, receipt, meta }) {
  if (receipt && meta) {
    meta.contractCallFailed = receipt.status === false
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
        eventBus.emit('eth-block', block)
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
    eventBus.emit('eth-block', header)

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
    eventBus.emit('wallet-state-changed', {
      // walletId is temporarily hardcoded
      1: {
        addresses: {
          [address]: {
            transactions: transactions.map(markFailedTransaction)
          }
        }
      }
    })
    eventBus.emit('eth-tx')
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
    const grouped = (groupBy(
      pendingEvents.filter(e => e.address === address),
      'event.transactionHash')
    )

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
          meta: { plugin: 'tokens' }
        })
      })

    pendingEvents = pendingEvents.filter(e => e.address !== address)
  }

  const debouncedEmitPendingEvents = debounce(
    emitPendingEvents,
    config.explorer.debounce
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

      // Get past events and subscribe to incoming events
      contract.events[eventName]({ fromBlock, filter })
        .on('data', queueAndEmitEvent(address, metaParser))
        .on('changed', queueAndEmitEvent(address, metaParser))
        .on('error', function (err) {
          debug('Shall resync events on next block')
          shallResync = true
          eventBus.emit('wallet-error', {
            inner: err,
            message: 'Subscription to events failed',
            meta: { plugin: 'explorer' }
          })
        })

      eventBus.on('eth-block', function ({ number }) {
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
                message: 'Failed to resync events',
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
        metaParser
      } = registration(address)

      const contract = new web3.eth.Contract(abi, contractAddress)

      return contract.getPastEvents(eventName, {
        fromBlock,
        toBlock,
        filter
      })
        .then(function (events) {
          debug(`${events.length} past ${eventName} events retrieved`)
          return Promise.all(events.map(queueAndEmitEvent(address, metaParser)))
            .then(noop)
        })
    }))
  }

  function subscribeEthTransactions (fromBlock, address) {
    let shallResync = false
    let bestSyncBlock = fromBlock

    const {
      getTransactions,
      getTransactionStream
    } = indexer(config.explorer)

    getTransactionStream(address)
      .on('data', queueAndEmitTransaction(address))
      .on('resync', function () {
        debug('Shall resync ETH transactions on next block')
        shallResync = true
      })
      .on('error', function (err) {
        debug('Shall resync ETH transactions on next block')
        shallResync = true
        eventBus.emit('wallet-error', {
          inner: err,
          message: 'Failed to sync transactions',
          meta: { plugin: 'explorer' }
        })
      })

    // Check if shall resync when a new block is seen, as that is the
    // indication of proper reconnection to the Ethereum node.
    eventBus.on('eth-block', function ({ number }) {
      if (shallResync) {
        shallResync = false
        getTransactions(bestSyncBlock, number, address)
          .then(function (transactions) {
            debug(`${transactions.length} past ETH transactions retrieved`)
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

  function getPastEthTransactions (fromBlock, toBlock, address) {
    const { getTransactions } = indexer(config.explorer)

    return getTransactions(fromBlock, toBlock, address)
      .then(function (transactions) {
        debug(`${transactions.length} past ETH transactions retrieved`)
        return Promise.all(transactions.map(queueAndEmitTransaction(address)))
          .then(noop)
      })
  }

  const syncTransactions = (fromBlock, address) =>
    started
      .then(function () {
        debug('Syncing', fromBlock, bestBlock)
        return Promise.all([
          bestBlock,
          getPastEthTransactions(fromBlock, bestBlock, address),
          subscribeEthTransactions(fromBlock, address),
          subscribeEvents(fromBlock, address)
        ])
      })
      .then(([best]) => best)

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
        eventBus.emit('eth-tx')
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
      eventBus.emit('eth-tx')
      return { receipt }
    })
  }

  function refreshTransaction (hash, address) {
    return web3.eth.getTransactionReceipt(hash)
      .then(function (receipt) {
        const pending = []

        // Refresh transaction
        if (web3.utils.toChecksumAddress(receipt.from) === address ||
          web3.utils.toChecksumAddress(receipt.to) === address) {
          pending.push(queueAndEmitTransaction(address)(hash))
        }

        // Refresh transaction events
        if (receipt && receipt.logs && receipt.logs.length) {
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
      getPastEthTransactions(0, bestBlock, address),
      getPastEvents(0, bestBlock, address)
    ])
  }

  return {
    api: {
      logTransaction,
      registerEvent,
      syncTransactions,
      refreshTransaction,
      refreshAllTransactions
    },
    events: [
      'eth-block',
      'wallet-error'
    ],
    name: 'explorer'
  }
}

function stop () {
  blocksStream.destroy()
}

module.exports = {
  start,
  stop
}
