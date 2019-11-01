'use strict'

// const debug = require('debug')
const PromiEvent = require('web3-core-promievent')

function emptyReceipt(tx) {
  return {
    blockHash: tx.blockhash,
    transactionHash: tx.txid,
    excepted: 'None',
    log: []
  }
}

function pollForReceipt(qtumRPC, promiEvent, txid) {
  const id = setInterval(function() {
    qtumRPC
      .rawCall('getrawtransaction', [txid, true])
      .then(function(tx) {
        if (!tx.confirmations) {
          return null
        }
        return qtumRPC
          .rawCall('gettransactionreceipt', [txid])
          .then(function([receipt]) {
            console.log('********* receipt', receipt)
            clearInterval(id)
            promiEvent.eventEmitter.emit('receipt', receipt || emptyReceipt(tx))
            promiEvent.resolve(receipt)
          })
      })
      .catch(function(err) {
        if (err.message.includes('No such mempool or blockchain transaction')) {
          return
        }
        clearInterval(id)
        promiEvent.eventEmitter.emit('error', err)
        promiEvent.reject(err)
      })
  }, 1000)
}

function toPromiEvent(qtumRPC, sendPromise) {
  const promiEvent = new PromiEvent()

  sendPromise
    .then(function(tx) {
      const { status, txid, message } = tx

      if (status) {
        throw new Error(message)
      }
      promiEvent.eventEmitter.emit('transactionHash', txid)

      pollForReceipt(qtumRPC, promiEvent, txid)
    })
    .catch(function(err) {
      promiEvent.eventEmitter.emit('error', err)
      promiEvent.reject(err)
    })

  return promiEvent.eventEmitter
}

module.exports = toPromiEvent
