'use strict'

const rateStreams = {
  bittrex: require('./bittrex-stream'),
  coincap: require('./coincap-stream')
}

function create () {
  let dataStream
  let refCount = 0

  function start ({ config, eventBus }) {
    const { ratesSource, ratesUpdateMs, symbol } = config

    const createStream = rateStreams[ratesSource.toLowerCase()]

    dataStream = createStream(symbol, ratesUpdateMs)

    dataStream.on('data', function (price) {
      const priceData = { token: symbol, currency: 'USD', price }
      eventBus.emit('coin-price-updated', priceData)
    })

    dataStream.on('error', function (err) {
      eventBus.emit('wallet-error', {
        inner: err,
        message: err.message,
        meta: { plugin: 'rates' }
      })
    })

    refCount += 1

    return {
      events: [
        'coin-price-updated'
      ]
    }
  }

  function stop () {
    refCount -= 1

    if (refCount < 1 && dataStream) {
      dataStream.destroy()
    }
  }

  return {
    start,
    stop
  }
}

module.exports = {
  create
}
