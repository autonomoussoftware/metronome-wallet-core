'use strict'

const EventEmitter = require('events')
const debug = require('debug')('met-wallet:core')

const defaultConfig = require('./defaultConfig')
const { merge } = require('lodash')

function createCore (givenConfig) {
  const config = Object.assign(defaultConfig, givenConfig)

  const pluginsCreators = [
    require('./plugins/coincap'),
    require('./plugins/eth'),
    require('./plugins/explorer'),
    require('./plugins/wallet'),
    require('./plugins/tokens'),
    require('./plugins/metronome')
  ]

  const plugins = pluginsCreators.map(plugin => plugin.create())

  let eventBus
  let initialized = false

  function start () {
    debug.enabled = config.debug

    if (initialized) {
      throw new Error('Wallet Core already initialized')
    }

    debug('Wallet core starting', config)

    eventBus = new EventEmitter()

    if (debug.enabled) {
      const emit = eventBus.emit.bind(eventBus)
      eventBus.emit = function (eventName, ...args) {
        debug('<<--', eventName, ...args)
        emit(eventName, ...args)
      }
    }

    const coreEvents = []
    const pluginsApi = {}

    plugins.forEach(function (plugin) {
      const params = { config, eventBus, plugins: pluginsApi }
      const { api, events, name } = plugin.start(params)

      if (api && name) {
        Object.assign(pluginsApi, { [name]: api })
      }

      if (events) {
        events.forEach(function (event) {
          if (!coreEvents.includes(event)) {
            coreEvents.push(event)
          }
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

    merge([], plugins).reverse().forEach(function (plugin) {
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

module.exports = {
  createCore
}
