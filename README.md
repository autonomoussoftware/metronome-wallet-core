# metronome-wallet-core

[![Greenkeeper badge](https://badges.greenkeeper.io/autonomoussoftware/metronome-wallet-core.svg)](https://greenkeeper.io/)

Core logic to develop an Ethereum Metronome wallet.

The core logic has a modular design where each module or plugin can emit events and expose methods to other plugins or the code client.

## Quick start

```js
const createCore = require('metronome-wallet-core')

const core = createCore()

const { api, emitter, events } = core.start()

// Listen for `events` on the `emitter`.
// Call `api` methods

core.stop()
```

## API

- `createCore()`: Creates a wallet core instance.

- `core.start({ config })`: Initializes the core logic. Returns an object containing the exposed methods in `api`, an `emitter` to expose events and the list of emitted events in the `events` array. See below for details.

- `core.stop()`: stops everything.

### Config

The configuration object has default properties as defined in `src/defaultConfig.json`.

### Plugins (modules)

All plugins must follow this pattern:

```js
function createPlugin () {
  return {
    start ({ config, eventBus, plugins }) {
      // Initialize
      return { events, name, api }
    },
    stop () {
      // Clean up
    }
  }
}
```

The `start` method will receive the core `config`, an `eventBus` emitter and an object containing all the other plugin's exposed methods.
The return object shall contain a list of `events` that might be interesting to the core's user, the `name` of the plugin and an object containing all `api` methods exposed.

The `eventBus` is the same instance as `core.start().emitter`.
All methods exposed by all plugins will be available to all other plugins and namespaced `core.start().api` using the `name` property.

The following plugins are bundled:

- `eth`: Provides connectivity with the Ethereum node.
- `explorer`: Provides notifications and keeps track of new blocks, transactions and events.
- `metronome`: Provides Metronome-specific functionality as interacting with the auctions, converter and token contracts.
- `rates`: Provides crypto-to-fiat exchange rates.
- `tokens`: Provides base ERC20 token functions.
- `wallet`: Provides base key/account management

## License

MIT
