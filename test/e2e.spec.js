'use strict'

const { identity, once, toLower } = require('lodash')
const bip39 = require('bip39')
const createDebug = require('debug')
const util = require('util')

require('chai').should()
require('dotenv').config()

const createCore = require('..')

createDebug.formatters.J = obj =>
  util.inspect(obj, { colors: true, depth: 4, sorted: true })
const debug = createDebug('metronome-wallet:core:test:e2e')

function addTests(fixtures) {
  const {
    address,
    blocksRange,
    config,
    receiptAddressFormatter,
    sendCoinDefaults,
    toAddress
  } = fixtures

  it('should initialize, emit rates and blocks', function(done) {
    this.timeout(240000)

    let blocksCount = 0
    let ratesCount = 0

    const core = createCore()
    const { api, emitter, events } = core.start(config)

    api.should.be.an('object')
    events.should.be.an('array')

    const end = once(function(err) {
      core.stop()
      done(err)
    })

    function checkEnd() {
      if (blocksCount >= 2 && ratesCount >= 2) {
        end()
      }
    }

    emitter.on('error', function(err) {
      end(err)
    })
    emitter.on('wallet-error', function(err) {
      end(new Error(err.message))
    })
    emitter.on('coin-block', function(blockHeader) {
      blockHeader.should.have.property('hash').that.is.a('string')
      blockHeader.should.have.property('number').that.is.a('number')
      blockHeader.should.have.property('timestamp').that.is.a('number')

      blocksCount += 1
      checkEnd()
    })
    emitter.on('coin-price-updated', function(data) {
      data.should.have.property('token', config.symbol)
      data.should.have.property('currency', 'USD')
      data.should.have.property('price').that.is.a('number')

      ratesCount += 1
      checkEnd()
    })
  })

  it('should emit wallet balance', function(done) {
    const walletId = 'walletId'

    const core = createCore()
    const { emitter } = core.start(config)

    const end = once(function(err) {
      core.stop()
      done(err)
    })

    emitter.on('error', function(err) {
      end(err)
    })
    emitter.on('wallet-error', function(err) {
      end(new Error(err.message))
    })
    emitter.on('wallet-state-changed', function(data) {
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

  it('should send coins and emit a wallet event', function(done) {
    this.timeout(0)

    const core = createCore()
    const { api, emitter } = core.start(config)

    const mnemonic = process.env.MNEMONIC
    const seed = bip39.mnemonicToSeedHex(mnemonic).toString('hex')
    const address0 = api.wallet.createAddress(seed)
    const privateKey = api.wallet.createPrivateKey(seed)
    const walletId = 'walletId'

    const to = toAddress
    const value = (Math.random() * 1000).toFixed()
    let events = 0

    const end = once(function(err) {
      core.stop()
      done(err)
    })

    emitter.on('error', function(err) {
      end(err)
    })
    emitter.on('wallet-error', function(err) {
      end(new Error(err.message))
    })
    emitter.on('wallet-state-changed', function(data) {
      try {
        const { transactions } = data[walletId].addresses[address0]
        if (!transactions) {
          return
        }
        debug('Transaction received %J', transactions)
        events += 1
        transactions.should.have.length(1)
        const { transaction, receipt, meta } = transactions[0]
        transaction.should.have.property('from', address0)
        transaction.should.have.property('hash').that.is.a('string')
        transaction.should.have.property('to', to)
        transaction.should.have.property('value', value)
        if (events === 2) {
          transaction.should.have.property('blockHash').that.is.a('string')
          transaction.should.have.property('blockNumber').that.is.a('number')
          receipt.should.have.property('blockHash', transaction.blockHash)
          receipt.should.have.property('blockNumber', transaction.blockNumber)
          receipt.should.have.property(
            'from',
            receiptAddressFormatter(address0)
          )
          receipt.should.have.property('logs').that.is.an('array')
          receipt.should.have.property('status').that.is.true
          receipt.should.have.property('to', receiptAddressFormatter(to))
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
      address: address0
    })

    const transactionObject = {
      from: address0,
      to,
      value,
      ...sendCoinDefaults
    }
    api.wallet.sendCoin(privateKey, transactionObject).catch(end)
  })

  it('should get past events', function(done) {
    const core = createCore()
    const { api, emitter } = core.start(config)

    const end = once(function(err) {
      core.stop()
      done(err)
    })

    emitter.on('error', function(err) {
      end(err)
    })
    emitter.on('wallet-error', function(err) {
      end(new Error(err.message))
    })

    const abi = api.erc20.abi
    api.metronome
      .getContractAddress('METToken')
      .then(contractAddress =>
        api.explorer
          .getPastEvents(abi, contractAddress, 'Transfer', {
            ...blocksRange,
            filter: { _from: address }
          })
          .then(function(events) {
            events.should.be.an('array').lengthOf(1)
            events[0].should.have.property('transactionHash')
            events[0].should.have.nested.property('returnValues._from', address)
            end()
          })
      )
      .catch(end)
  })

  it('should emit past events', function(done) {
    this.timeout(0)

    const walletId = 'walletId'

    const core = createCore()
    const { api, emitter } = core.start(config)

    const end = once(function(err) {
      core.stop()
      done(err)
    })

    let syncEnded = false
    let stateChanged = false

    function checkEnd() {
      if (syncEnded && stateChanged) {
        end()
      }
    }

    emitter.on('error', function(err) {
      end(err)
    })
    emitter.on('wallet-error', function(err) {
      end(new Error(err.message))
    })
    emitter.on('wallet-state-changed', function(data) {
      if (data[walletId].addresses[address].balance) {
        return
      }
      data[walletId].addresses[address].should.have.nested
        .property('transactions[0]')
        .that.include.all.keys('transaction', 'receipt', 'meta')
      // TODO check meta is parsed to native addresses
      stateChanged = true
      checkEnd()
    })
    emitter.on('coin-block', function() {
      const { fromBlock, toBlock } = blocksRange
      api.transactionsSyncer
        .getPastEvents(fromBlock, toBlock, address)
        .then(function() {
          syncEnded = true
          checkEnd()
        })
        .catch(end)
    })

    emitter.emit('open-wallets', {
      activeWallet: walletId,
      address
    })
  })
}

describe('Core E2E', function() {
  before(function() {
    if (!process.env.E2E) {
      this.skip()
    }
  })

  describe('Core API', function() {
    it.skip('should expose the same API regardless the chain type', function() {
      // TODO check against the public/documented API
      const ethCore = createCore().start({
        chainId: 3,
        chainType: 'ethereum',
        indexerUrl: process.env.ROPSTEN_INDEXER,
        wsApiUrl: process.env.ROPSTEN_NODE,
        symbol: 'ETH'
      })
      const qtumCore = createCore().start({
        chainId: 'test',
        chainType: 'qtum',
        explorerApiUrl: process.env.QTUMTEST_EXPLORER,
        nodeUrl: process.env.QTUMTEST_NODE,
        symbol: 'QTUM'
      })
      qtumCore.api.should.have.all.keys(ethCore.api)
      qtumCore.events.should.have.members(ethCore.events)
    })
  })

  describe('Ethereum', function() {
    this.slow(30000) // 2 blocks
    const fixtures = {
      address: '0x079215597D4f6837e00e97099beE1F8974Bae61b',
      config: {
        indexerUrl: process.env.ROPSTEN_INDEXER,
        ratesUpdateMs: 5000,
        symbol: 'ETH',
        wsApiUrl: process.env.ROPSTEN_NODE
      },
      blocksRange: {
        fromBlock: 6802000,
        toBlock: 6802100
      },
      receiptAddressFormatter: toLower,
      sendCoinDefaults: {
        gas: 21000,
        gasPrice: '1000000000'
      },
      toAddress: process.env.TO_ETH_ADDRESS
    }
    addTests(fixtures)
  })

  describe('Qtum', function() {
    this.slow(240000) // 2 blocks
    const fixtures = {
      address: 'qTb9C5NeNTmKfNvvViTCUDsqBSDm9hrEe4',
      config: {
        chainId: 'test',
        chainType: 'qtum',
        explorerApiUrl: process.env.QTUMTEST_EXPLORER,
        nodeUrl: process.env.QTUMTEST_NODE,
        ratesUpdateMs: 5000,
        symbol: 'QTUM'
      },
      blocksRange: {
        fromBlock: 485550,
        toBlock: 485600
      },
      receiptAddressFormatter: identity,
      sendCoinDefaults: {
        feeRate: 402
      },
      toAddress: process.env.TO_QTUM_ADDRESS
    }
    addTests(fixtures)
  })
})
