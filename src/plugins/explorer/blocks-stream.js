'use strict'

function createStream (web3) {
  const subscription = web3.eth.subscribe('newBlockHeaders')

  web3.eth.getBlock('latest')
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
