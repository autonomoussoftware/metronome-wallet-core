'use strict'

const { once } = require('lodash')
const bip39 = require('bip39')
const createDebug = require('debug')
const util = require('util')

require('chai').should()
require('dotenv').config()

const createCore = require('..')

createDebug.formatters.J = obj =>
  util.inspect(obj, { colors: true, depth: 4, sorted: true })
const debug = createDebug('metronome-wallet:core:test:e2e')

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

    it('should send ETH and emit a wallet event', function (done) {
      this.timeout(0)

      const core = createCore()
      const config = {
        indexerUrl: process.env.ROPSTEN_INDEXER,
        wsApiUrl: process.env.ROPSTEN_NODE
      }
      const { api, emitter } = core.start(config)

      const mnemonic = process.env.MNEMONIC
      const seed = bip39.mnemonicToSeedHex(mnemonic).toString('hex')
      const address = api.wallet.createAddress(seed)
      const privateKey = api.wallet.createPrivateKey(seed)
      const walletId = 1

      const to = process.env.TO_ETH_ADDRESS
      const value = (Math.random() * 1000).toFixed()
      let events = 0

      const end = once(done)

      emitter.on('error', function (err) {
        end(err)
      })
      emitter.on('wallet-error', function (err) {
        end(new Error(err.message))
      })
      emitter.on('wallet-state-changed', function (data) {
        try {
          const { transactions } = data[walletId].addresses[address]
          if (!transactions) {
            return
          }
          events += 1
          transactions.should.have.length(1)
          const { transaction, receipt, meta } = transactions[0]
          transaction.should.have.property('from', address)
          transaction.should.have.property('hash').that.is.a('string')
          transaction.should.have.property('to', to)
          transaction.should.have.property('value', value)
          if (events === 2) {
            transaction.should.have.property('blockHash').that.is.a('string')
            transaction.should.have.property('blockNumber').that.is.a('number')
            receipt.should.have.property('blockHash', transaction.blockHash)
            receipt.should.have.property('blockNumber', transaction.blockNumber)
            receipt.should.have.property('from', address.toLowerCase())
            receipt.should.have.property('logs').that.is.an('array')
            receipt.should.have.property('status').that.is.true
            receipt.should.have.property('to', to.toLowerCase())
            receipt.should.have.property('transactionHash').that.is.a('string')
            meta.should.deep.equal({ contractCallFailed: false })
            end()
          } else if (events > 2) {
            end(new Error('Test should have never reached here'))
          }
        } catch (err) {
          end(err)
        }
      })

      emitter.emit('open-wallets', {
        walletIds: [walletId],
        activeWallet: walletId,
        address
      })

      const transactionObject = {
        from: address,
        to,
        value,
        gas: 21000
        // gasPrice: '2000000000'
      }
      api.wallet.sendCoin(privateKey, transactionObject).catch(end)
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

    it('should send QTUM and emit a wallet event', function (done) {
      this.timeout(0)

      const core = createCore()
      const config = {
        chainId: 'test',
        chainType: 'qtum',
        explorerUrl: process.env.QTUMTEST_EXPLORER,
        nodeUrl: process.env.QTUMTEST_NODE
      }
      const { api, emitter } = core.start(config)

      const mnemonic = process.env.MNEMONIC
      const seed = bip39.mnemonicToSeedHex(mnemonic).toString('hex')
      const address = api.wallet.createAddress(seed)
      const privateKey = api.wallet.createPrivateKey(seed)
      const walletId = 1

      const to = process.env.TO_QTUM_ADDRESS
      const value = (Math.random() * 1000).toFixed()
      let events = 0

      const end = once(done)

      emitter.on('error', function (err) {
        end(err)
      })
      emitter.on('wallet-error', function (err) {
        end(new Error(err.message))
      })
      emitter.on('wallet-state-changed', function (data) {
        try {
          const { transactions } = data[walletId].addresses[address]
          if (!transactions) {
            return
          }
          debug('Transaction received %J', transactions)
          events += 1
          transactions.should.have.length(1)
          const { transaction, receipt, meta } = transactions[0]
          transaction.should.have.property('from', address)
          transaction.should.have.property('hash').that.is.a('string')
          transaction.should.have.property('to', to)
          transaction.should.have.property('value', value)
          if (events === 2) {
            transaction.should.have.property('blockHash').that.is.a('string')
            transaction.should.have.property('blockNumber').that.is.a('number')
            receipt.should.have.property('blockHash', transaction.blockHash)
            receipt.should.have.property('blockNumber', transaction.blockNumber)
            receipt.should.have.property('from', address)
            receipt.should.have.property('logs').that.is.an('array')
            receipt.should.have.property('status').that.is.true
            receipt.should.have.property('to', to)
            receipt.should.have.property('transactionHash').that.is.a('string')
            meta.should.deep.equal({ contractCallFailed: false })
            end()
          } else if (events > 2) {
            end(new Error('Test should have never reached here'))
          }
        } catch (err) {
          end(err)
        }
      })

      emitter.emit('open-wallets', {
        walletIds: [walletId],
        activeWallet: walletId,
        address
      })

      const transactionObject = {
        from: address,
        to,
        value
        // feeRate: 40?
      }
      api.wallet.sendCoin(privateKey, transactionObject).catch(end)
    })
  })
})
