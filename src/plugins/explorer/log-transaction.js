'use strict'

const pDefer = require('p-defer')

const createLogTransaction = queue =>
  function (promiEvent, from, meta) {
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

module.exports = createLogTransaction
