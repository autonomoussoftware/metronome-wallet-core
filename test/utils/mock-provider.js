'use strict'

function MockProvider (responses, delay = 50) {
  this._delay = delay
  this._responses = responses
}

MockProvider.prototype.send = function (payload, callback) {
  // eslint-disable-next-line arrow-body-style
  setTimeout(() => {
    try {
      callback(null, {
        id: payload.id,
        jsonrpc: '2.0',
        result: this._responses[payload.method](...payload.params)
      })
    } catch (err) {
      callback(err)
    }
  }, this._delay)
}

MockProvider.prototype.on = function() {
  console.warn('Suscriptions mocked but not implemented.')
}

module.exports = MockProvider
