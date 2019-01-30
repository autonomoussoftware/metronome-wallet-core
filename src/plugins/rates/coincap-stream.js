'use strict'

const { throttle } = require('lodash')
const coincap = require('coincap-lib')
const EventEmitter = require('events')

function createDataStream (ticker, minInterval) {
  const stream = new EventEmitter()

  const throttledStreamEmit = throttle(
    stream.emit.bind(stream),
    minInterval,
    { leading: true, trailing: false }
  )

  coincap.on('trades', function (trade) {
    if (trade.coin !== ticker || trade.market_id !== `${ticker}_USD`) {
      return
    }
    if (typeof trade.msg.price !== 'number') {
      return
    }

    throttledStreamEmit('data', trade.msg.price)
  })
  coincap.on('disconnect', function (reason) {
    stream.emit('error', new Error(`Disconnected from CoinCap with ${reason}`))
  })
  coincap.on('error', function (err) {
    stream.emit('error', err)
  })
  coincap.open()

  coincap.coin(ticker)
    .then(function ({ price }) {
      if (typeof price !== 'number') {
        return
      }

      throttledStreamEmit('data', price)
    })
    .catch(function (err) {
      stream.emit('error', err)
    })

  stream.destroy = function () {
    coincap.close()
  }

  return stream
}

module.exports = createDataStream
