# metronome-wallet-core

Core logic to develop an Ethereum Metronome wallet.

The core logic has a modular design where each module or plugin can emit events and expose methods to other plugins or the code client.

## Quick start

```js
const core = require('metronome-wallet-core')

const { api, emitter, events } = core.start()

// Listen for `events` on the `emitter`.
// Call `api` methods

core.stop()
```

## API

- `core.start({ config })`: Initializes the wallet core logic. Returns an object containing the core methods in `api`, the list of emitted events in the `events` Array and the `emitter` EventEmitter.
- `core.stop()`: stops everything.

### Config

The configuration object has the following core-global properties:

- `debug`: forces logging of debug messages to console.

Each plugin has its own configuration options.

### Emitter and events

The core emits events on the `events` object after the core logic is started.
The list of possible events are exposed in the `events` array.

Each plugin can add events to the list, emit and listen for events in the `emitter` object.

### Methods

Each plugin can add methods to the `api` object under the plugin's namespace.

### Plugins (modules)

The following plugins are bundled:

- `eth`: Provides connectivity with the Ethereum node.
- `explorer`: Provides notifications and keeps track of new blocks, transactions and events.
- `metronome`: Provides Metronome-specific functionality as interacting with the auctions, converter and token contracts.
- `rates`: Provides ETH to USD exchange rates.
- `tokens`: Provides base ERC20 token functions.
- `wallet`: Provides base key/account management

## License

MIT
