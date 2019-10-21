'use strict'

/**
 * Create a stream that emits every new mined block.
 *
 * @param {object} web3 A web3 instance.
 * @returns {object} A stream object that emits `data` on each block.
 */
function createStream (web3) {
  const subscription = web3.eth.subscribe('newBlockHeaders')

  web3.eth
    .getBlock('latest')
    .then(function (block) {
      subscription.emit('data', block)
    })
    .catch(function (err) {
      subscription.emit('error', err)
    })

  subscription.destroy = subscription.unsubscribe

  return subscription
}

module.exports = createStream
