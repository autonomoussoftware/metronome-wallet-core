'use strict'

const rateStreams = {
  bittrex: require('./bittrex-stream'),
  coincap: require('./coincap-stream')
}

function createPlugin () {
  let dataStream

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
        message: `Could not get exchange rate for ${symbol}`,
        meta: { plugin: 'rates' }
      })
    })

    return {
      events: [
        'coin-price-updated',
        'wallet-error'
      ]
    }
  }

  function stop () {
    dataStream.destroy()
  }

  return {
    start,
    stop
  }
}

module.exports = createPlugin
