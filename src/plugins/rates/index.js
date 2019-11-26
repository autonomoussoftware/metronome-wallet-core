'use strict'

const { getExchangeRate } = require('safe-exchange-rate')
const debug = require('debug')('metronome-wallet:core:rates')

const createStream = require('./stream')

/**
 * Create a plugin instance.
 *
 * @returns {({ start: Function, stop: () => void})} The plugin instance.
 */
function createPlugin() {
  let dataStream

  /**
   * Start the plugin instance.
   *
   * @param {object} options Start options.
   * @returns {{ events: string[] }} The instance details.
   */
  function start({ config, eventBus }) {
    debug('Starting')

    const { ratesUpdateMs, symbol } = config

    const emit = {
      price(priceData) {
        eventBus.emit('coin-price-updated', priceData)
      },
      walletError(message, err) {
        debug('Wallet error: %s', err.message)
        eventBus.emit('wallet-error', {
          inner: err,
          message,
          meta: { plugin: 'rates' }
        })
      }
    }

    const getRate = () =>
      getExchangeRate(`${symbol}:USD`).then(function(rate) {
        if (typeof rate !== 'number') {
          throw new Error(`No exchange rate retrieved for ${symbol}`)
        }
        return rate
      })

    dataStream = createStream(getRate, ratesUpdateMs)
    dataStream.on('data', function(price) {
      const priceData = { token: symbol, currency: 'USD', price }
      emit.price(priceData)
    })
    dataStream.on('error', function(err) {
      emit.walletError(`Could not get exchange rate for ${symbol}`, err)
    })

    return {
      events: ['coin-price-updated', 'wallet-error']
    }
  }

  /**
   * Stop the plugin instance.
   */
  function stop() {
    debug('Stopping')

    dataStream.destroy()
  }

  return {
    start,
    stop
  }
}

module.exports = createPlugin
