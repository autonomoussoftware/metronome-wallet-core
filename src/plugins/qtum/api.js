'use strict'

const { Contract } = require('qtumjs')
const debug = require('debug')('metronome-wallet:core:qtum:api')
const EventEmitter = require('events')

const createToPromiEvent = require('./to-promievent')

function createApi(qtumRPC) {
  function subscribeToEvents(abi, contractAddress, eventName, options) {
    debug('Subscribing to %s@%s', eventName, contractAddress)
    const contract = new Contract(qtumRPC, {
      abi,
      address: contractAddress
    })
    const emitter = new EventEmitter()
    const logEmitter = contract
      .logEmitter(options)
      .on(eventName, function(event) {
        debug('Subscription event received: %s %j', eventName, event)
        emitter.emit('data', event)
      })
      .on('error', function(err) {
        emitter.emit('error', err)
      })
    emitter.unsubscribe = function() {
      logEmitter.removeAllListeners()
    }
    return emitter
  }

  return {
    subscribeToEvents,
    toPromiEvent: createToPromiEvent(qtumRPC)
  }
}

module.exports = createApi
