/**
 * @typedef CoreConfig
 * @property {number | string} [chainId]
 * @property {string} [chainType]
 * @property {boolean} [debug]
 * @property {string} [explorerUrl]
 * @property {string} [indexerUrl]
 * @property {string} [nodeUrl]
 * @property {string} [symbol]
 * @property {boolean} [useNativeCookieJar]
 * @property {string} [wsApiUrl]
 *
 * @typedef CoreOptions
 * @property {CoreConfig} config
 * @property {object} [eventBus]
 * @property {object} plugins
 *
 * @typedef CoreInterface
 * @property {object} api
 * @property {object} emitter
 * @property {string[]} events
 *
 * @typedef  CoreInstance
 * @property {(config: CoreConfig) => CoreInterface} start
 * @property {() => void} stop
 *
 * @typedef CorePluginInterface
 * @property {object} [api]
 * @property {string[]} [events]
 * @property {string} [name]
 *
 * @typedef CorePlugin
 * @property {(options: CoreOptions) => CorePluginInterface} start
 * @property {() => void} stop
 */
