'use strict'

function MockProvider (responses, delay = 50) {
  this._delay = delay
  this._responses = responses
}

MockProvider.prototype.send = function (payload, callback) {
  setTimeout(() => callback(null, {
    id: payload.id,
    jsonrpc: '2.0',
    result: this._responses[payload.method](...payload.params)
  }), this._delay)
}

module.exports = MockProvider
