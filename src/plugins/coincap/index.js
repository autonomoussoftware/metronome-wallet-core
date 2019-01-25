'use strict'

const createStream = require('./coincap-stream')
const throttle = require('lodash/throttle')

function create () {
  let dataStream

  function start ({ config, eventBus }) {
    function emitPrice (price) {
      const priceData = { token: config.symbol, currency: 'USD', price }
      eventBus.emit('coin-price-updated', priceData)
    }

    const throttledEmitPrice = throttle(
      emitPrice,
      config.ratesUpdateMs,
      { leading: true, trailing: false }
    )

    dataStream = createStream(config.symbol, `${config.symbol}_USD`)

    dataStream.on('data', throttledEmitPrice)

    dataStream.on('error', function (err) {
      eventBus.emit('wallet-error', {
        inner: err,
        message: err.message,
        meta: { plugin: 'coincap' }
      })
    })

    return {
      events: [
        'coin-price-updated'
      ]
    }
  }

  function stop () {
    dataStream.destroy()
    dataStream = null
  }

  return {
    start,
    stop
  }
}

module.exports = {
  create
}
