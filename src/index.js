'use strict'

const { merge, union } = require('lodash')
const debug = require('debug')('metronome-wallet:core')
const EventEmitter = require('events')

const defaultConfig = require('./defaultConfig.json')

const pluginsList = {
  ethereum: [
    'rates',
    'eth',
    'eth-blocks',
    'explorer',
    'coin-balance',
    'wallet',
    'tokens',
    'metronome'
  ],
  qtum: ['rates', 'qtum', 'qtuminfo-explorer', 'coin-balance']
}

/**
 * Create a wallet core instance.
 *
 * @returns {CoreInstance} The wallet core instance.
 */
function createCore () {
  let eventBus
  let initialized = false
  let plugins

  /**
   * Start the wallet core instance.
   *
   * @param {CoreConfig} givenConfig The wallet core config.
   * @returns {CoreInterface} The code API.
   */
  function start (givenConfig) {
    if (initialized) {
      throw new Error('Wallet Core already initialized')
    }

    const config = merge({}, defaultConfig, givenConfig)

    debug('Starting %j', config)

    eventBus = new EventEmitter()

    if (config.debug) {
      process.env.DEBUG = `${
        process.env.DEBUG ? `${process.env.DEBUG},` : ''
      }metronome-wallet:core*`
      const emit = eventBus.emit.bind(eventBus)
      eventBus.emit = function (eventName, ...args) {
        debug('<<-- %s', eventName, ...args)
        return emit(eventName, ...args)
      }
    }

    let coreEvents = []
    const pluginsApi = {}

    debug('Initializing plugins for %s', config.chainType)

    plugins = pluginsList[config.chainType]
      .map(name => require(`./plugins/${name}`))
      .map(create => create())

    plugins.forEach(function (plugin) {
      const params = { config, eventBus, plugins: pluginsApi }
      const { api, events, name } = plugin.start(params)

      if (api && name) {
        pluginsApi[name] = api
      }

      if (events) {
        coreEvents = union(coreEvents, events)
      }
    })

    debug('Exposed events %j', coreEvents)

    initialized = true

    return {
      api: pluginsApi,
      emitter: eventBus,
      events: coreEvents
    }
  }

  /**
   * Stop the wallet core instance.
   */
  function stop () {
    debug('Stopping')

    if (!initialized) {
      throw new Error('Wallet Core not initialized')
    }

    plugins.reverse().forEach(function (plugin) {
      plugin.stop()
    })

    plugins = null

    eventBus.removeAllListeners()
    eventBus = null

    initialized = false
  }

  return {
    start,
    stop
  }
}

module.exports = createCore
