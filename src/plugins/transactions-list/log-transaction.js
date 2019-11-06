'use strict'

const { noop } = require('lodash')
const pDefer = require('p-defer')

const createLogTransaction = queue =>
  function(promiEvent, from, meta) {
    // PromiEvent objects shall be wrapped to avoid the promise chain to
    // cast it to a plain promise
    if (promiEvent.once) {
      const deferred = pDefer()

      promiEvent.once('transactionHash', function(hash) {
        queue.addTransaction(from, meta)(hash)
      })
      promiEvent.once('receipt', function(receipt) {
        queue.addTransaction(from)(receipt.transactionHash)
        deferred.resolve({ receipt })
      })
      promiEvent.once('error', function(err) {
        promiEvent.removeAllListeners()
        deferred.reject(err)
      })

      // Capture promiEvent rejections and do nothing since we are already
      // listening for `error` events
      promiEvent.catch(noop)

      return deferred.promise
    }

    // But it can also be a plain promise instead.
    const promise = promiEvent
    return promise.then(function(receipt) {
      queue.addTransaction(from)(receipt.transactionHash)
      return { receipt }
    })
  }

module.exports = createLogTransaction
