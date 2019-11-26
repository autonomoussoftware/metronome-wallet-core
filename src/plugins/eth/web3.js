'use strict'

const debug = require('debug')('metronome-wallet:core:eth:web3')
const Web3 = require('web3')

function createWeb3(wsApiUrl, web3Timeout, emit) {
  const web3 = new Web3(
    new Web3.providers.WebsocketProvider(wsApiUrl, {
      autoReconnect: true,
      timeout: web3Timeout
    })
  )

  web3.currentProvider.on('connect', function() {
    debug('Web3 provider connected')
    emit.connectionStatus(true)
  })
  web3.currentProvider.on('error', function(event) {
    debug('Web3 provider connection error', event.type || event.message)
    emit.connectionStatus(false)
  })
  web3.currentProvider.on('end', function(event) {
    debug('Web3 provider connection ended', event.reason)
    emit.connectionStatus(false)
  })

  return web3
}

function destroyWeb3(web3) {
  web3.currentProvider.disconnect()
}

module.exports = {
  createWeb3,
  destroyWeb3
}
