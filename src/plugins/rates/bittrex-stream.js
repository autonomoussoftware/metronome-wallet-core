'use strict'

const { BittrexClient } = require('bittrex-node')
const EventEmitter = require('events')

const client = new BittrexClient()

function createStream (ticker, minInterval) {
  const stream = new EventEmitter()

  let timeout

  const emitTickerValue = () =>
    client.ticker(`USD-${ticker}`)
      .then(function (values) {
        if (typeof values.Last !== 'number') {
          return
        }

        stream.emit('data', values.Last)
      })
      .catch(function (err) {
        stream.emit('error', err)
      })
      .then(function () {
        timeout = setTimeout(emitTickerValue, minInterval)
      })

  emitTickerValue()

  stream.destroy = function () {
    if (timeout) {
      clearTimeout(timeout)
    }
  }

  return stream
}

module.exports = createStream
