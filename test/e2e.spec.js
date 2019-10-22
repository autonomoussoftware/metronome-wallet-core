'use strict'

const { once } = require('lodash')
require('chai').should()
require('dotenv').config()

const createCore = require('..')

describe('Core E2E', function () {
  before(function () {
    if (!process.env.E2E) {
      this.skip()
    }
  })

  describe('Ethereum', function () {
    it('should initialize, emit rates and blocks', function (done) {
      this.timeout(0)

      let blocksCount = 0
      let ratesCount = 0

      const core = createCore()
      const config = {
        indexerUrl: process.env.ROPSTEN_INDEXER,
        ratesUpdateMs: 5000,
        symbol: 'ETH',
        wsApiUrl: process.env.ROPSTEN_NODE
      }
      const { api, emitter, events } = core.start(config)

      api.should.be.an('object')
      events.should.be.an('array')

      const end = once(done)

      function checkEnd () {
        if (blocksCount >= 2 && ratesCount >= 2) {
          core.stop()
          end()
        }
      }

      emitter.on('error', function (err) {
        end(err)
      })
      emitter.on('wallet-error', function (err) {
        end(new Error(err.message))
      })
      emitter.on('coin-block', function (blockHeader) {
        blockHeader.should.have.property('hash').that.is.a('string')
        blockHeader.should.have.property('number').that.is.a('number')
        blockHeader.should.have.property('timestamp').that.is.a('number')

        blocksCount += 1
        checkEnd()
      })
      emitter.on('coin-price-updated', function (data) {
        data.should.have.property('token', config.symbol)
        data.should.have.property('currency', 'USD')
        data.should.have.property('price').that.is.a('number')

        ratesCount += 1
        checkEnd()
      })
    })

    it('should emit wallet balance', function (done) {
      this.timeout(0)

      const address = '0x079215597D4f6837e00e97099beE1F8974Bae61b'
      const walletId = 1

      const core = createCore()
      const config = {
        indexerUrl: process.env.ROPSTEN_INDEXER,
        wsApiUrl: process.env.ROPSTEN_NODE
      }
      const { emitter } = core.start(config)

      const end = once(done)

      emitter.on('error', function (err) {
        end(err)
      })
      emitter.on('wallet-error', function (err) {
        end(new Error(err.message))
      })
      emitter.on('wallet-state-changed', function (data) {
        try {
          data.should.have.nested
            .property(`${walletId}.addresses.${address}.balance`)
            .that.is.a('string')
          end()
        } catch (err) {
          end(err)
        }
      })

      emitter.emit('open-wallets', { activeWallet: walletId, address })
    })
  })

  describe('Qtum', function () {
    it('should initialize, emit rates and blocks', function (done) {
      this.timeout(0)

      let blocksCount = 0
      let ratesCount = 0

      const core = createCore()
      const config = {
        chainId: 'test',
        chainType: 'qtum',
        explorerUrl: process.env.QTUMTEST_EXPLORER,
        nodeUrl: process.env.QTUMTEST_NODE,
        ratesUpdateMs: 5000,
        symbol: 'QTUM'
      }
      const { api, emitter, events } = core.start(config)

      api.should.be.an('object')
      events.should.be.an('array')

      const end = once(done)

      function checkEnd () {
        if (blocksCount >= 2 && ratesCount >= 2) {
          core.stop()
          end()
        }
      }

      emitter.on('error', function (err) {
        end(err)
      })
      emitter.on('wallet-error', function (err) {
        end(new Error(err.message))
      })
      emitter.on('coin-block', function (blockHeader) {
        blockHeader.should.have.property('hash').that.is.a('string')
        blockHeader.should.have.property('number').that.is.a('number')
        blockHeader.should.have.property('timestamp').that.is.a('number')

        blocksCount += 1
        checkEnd()
      })
      emitter.on('coin-price-updated', function (data) {
        data.should.have.property('token', config.symbol)
        data.should.have.property('currency', 'USD')
        data.should.have.property('price').that.is.a('number')

        ratesCount += 1
        checkEnd()
      })
    })

    it('should emit wallet balance', function (done) {
      this.timeout(0)

      const address = 'qTb9C5NeNTmKfNvvViTCUDsqBSDm9hrEe4'
      const walletId = 1

      const core = createCore()
      const config = {
        chainId: 'test',
        chainType: 'qtum',
        explorerUrl: process.env.QTUMTEST_EXPLORER,
        nodeUrl: process.env.QTUMTEST_NODE
      }
      const { emitter } = core.start(config)

      const end = once(done)

      emitter.on('error', function (err) {
        end(err)
      })
      emitter.on('wallet-error', function (err) {
        end(new Error(err.message))
      })
      emitter.on('wallet-state-changed', function (data) {
        try {
          data.should.have.nested
            .property(`${walletId}.addresses.${address}.balance`)
            .that.is.a('string')
          end()
        } catch (err) {
          end(err)
        }
      })

      emitter.emit('open-wallets', { activeWallet: walletId, address })
    })
  })
})
