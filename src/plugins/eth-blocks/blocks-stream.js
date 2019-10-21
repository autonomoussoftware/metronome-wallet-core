'use strict'

const { noop } = require('lodash')
const debug = require('debug')('metronome-wallet:core:eth-blocks:stream')

/**
 * Create a stream that emits every new mined block.
 *
 * @param {object} web3 A web3 instance.
 * @returns {object} A stream object that emits `data` on each block.
 */
function createStream (web3) {
  debug('Subscribing to new block headers')

  const subscription = web3.eth.subscribe('newBlockHeaders')
  subscription.destroy = function (callback = noop) {
    subscription.unsubscribe(function (err, success) {
      if (err) {
        debug('Could not unsubscribe %s', err.message)
      }
      callback(err, success)
    })
  }

  debug('Getting latest block')

  web3.eth
    .getBlock('latest')
    .then(function (block) {
      subscription.emit('data', block)
    })
    .catch(function (err) {
      subscription.emit('error', err)
    })

  return subscription
}

module.exports = createStream
