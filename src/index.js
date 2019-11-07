'use strict'

const { merge, union } = require('lodash')
const debug = require('debug')('metronome-wallet:core')
const EventEmitter = require('events')

const defaultConfig = require('./defaultConfig.json')

// Require all plugins in advance to allow static check of missing dependencies
/* eslint-disable quote-props */
const plugins = {
  'coin-balance': require('./plugins/coin-balance'),
  erc20: require('./plugins/erc20'),
  eth: require('./plugins/eth'),
  'eth-blocks': require('./plugins/eth-blocks'),
  'eth-tokens': require('./plugins/eth-tokens'),
  'eth-wallet': require('./plugins/eth-wallet'),
  explorer: require('./plugins/explorer'),
  metronome: require('./plugins/metronome'),
  qtum: require('./plugins/qtum'),
  'qtum-tokens': require('./plugins/qtum-tokens'),
  'qtum-wallet': require('./plugins/qtum-wallet'),
  'qtuminfo-explorer': require('./plugins/qtuminfo-explorer'),
  rates: require('./plugins/rates'),
  'tokens-balance': require('./plugins/tokens-balance'),
  'transactions-list': require('./plugins/transactions-list'),
  'transactions-syncer': require('./plugins/transactions-syncer')
}
/* eslint-enable quote-props */

const pluginsList = {
  ethereum: [
    'rates',
    'eth',
    'eth-blocks',
    'explorer',
    'transactions-list',
    'transactions-syncer',
    'coin-balance',
    'eth-wallet',
    'erc20',
    'eth-tokens',
    'tokens-balance',
    'metronome'
  ],
  qtum: [
    'rates',
    'qtum',
    'qtuminfo-explorer',
    'transactions-list',
    'transactions-syncer',
    'coin-balance',
    'qtum-wallet',
    'erc20',
    'qtum-tokens',
    'tokens-balance',
    'metronome'
  ]
}

/**
 * Create a wallet core instance.
 *
 * @returns {CoreInstance} The wallet core instance.
 */
function createCore() {
  let eventBus
  let initialized = false
  let corePlugins

  /**
   * Start the wallet core instance.
   *
   * @param {CoreConfig} givenConfig The wallet core config.
   * @returns {CoreInterface} The code API.
   */
  function start(givenConfig) {
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
      eventBus.emit = function(eventName, ...args) {
        debug('<<-- %s', eventName, ...args)
        return emit(eventName, ...args)
      }
    }

    let coreEvents = []
    const pluginsApi = {}

    debug('Initializing plugins for %s', config.chainType)

    corePlugins = pluginsList[config.chainType]
      .map(name => plugins[name])
      .map(create => create())

    corePlugins.forEach(function(plugin) {
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
  function stop() {
    debug('Stopping')

    if (!initialized) {
      throw new Error('Wallet Core not initialized')
    }

    corePlugins.reverse().forEach(function(plugin) {
      plugin.stop()
    })

    corePlugins = null

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
