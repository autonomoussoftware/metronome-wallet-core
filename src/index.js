'use strict'

const { merge, without } = require('lodash')
const debug = require('debug')('met-wallet:core')
const EventEmitter = require('events')

const defaultConfig = require('./defaultConfig')

const plugins = [
  require('./plugins/rates'),
  require('./plugins/eth'),
  require('./plugins/explorer'),
  require('./plugins/wallet'),
  require('./plugins/tokens'),
  require('./plugins/metronome')
].map(create => create())

function createCore () {
  let eventBus
  let initialized = false

  function start (givenConfig) {
    if (initialized) {
      throw new Error('Wallet Core already initialized')
    }

    const config = merge({}, defaultConfig, givenConfig)

    eventBus = new EventEmitter()

    debug.enabled = config.debug
    if (config.debug) {
      const emit = eventBus.emit.bind(eventBus)
      eventBus.emit = function (eventName, ...args) {
        debug('<<--', eventName, ...args)
        emit(eventName, ...args)
      }
    }

    debug('Wallet core starting', config)

    const coreEvents = []
    const pluginsApi = {}

    plugins.forEach(function (plugin) {
      const params = { config, eventBus, plugins: pluginsApi }
      const { api, events, name } = plugin.start(params)

      if (api && name) {
        pluginsApi[name] = api
      }

      if (events) {
        without(events, coreEvents).forEach(function (event) {
          coreEvents.push(event)
        })
      }
    })

    debug('Exposed events', coreEvents)

    initialized = true

    return {
      api: pluginsApi,
      emitter: eventBus,
      events: coreEvents
    }
  }

  function stop () {
    if (!initialized) {
      throw new Error('Wallet Core not initialized')
    }

    [].concat(plugins).reverse().forEach(function (plugin) {
      plugin.stop()
    })

    eventBus.removeAllListeners()
    eventBus = null

    initialized = false

    debug('Wallet core stopped')
  }

  return {
    start,
    stop
  }
}

module.exports = createCore
