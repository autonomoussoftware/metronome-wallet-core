'use strict'

const {
  once
} = require('lodash')
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
const EventEmitter = require('events')
const MetronomeContracts = require('metronome-contracts')
const proxyquire = require('proxyquire').noPreserveCache().noCallThru()
const Web3 = require('web3')

const {
  randomAddress,
  randomTxId
} = require('./utils')
const MockProvider = require('./utils/mock-provider')

const {
  getEventDataCreator
} = require('../src/plugins/metronome/auction-events')
const {
  getEventDataCreators
} = require('../src/plugins/tokens/events')

const explorer = proxyquire('../src/plugins/explorer', {
  './indexer': () => ({ getTransactions: () => Promise.resolve([]) })
}).create()

const should = chai.use(chaiAsPromised).should()

const config = { debug: true, explorer: { debuounce: 100 } }
const web3 = new Web3()

describe('Explorer plugin', function () {
  describe('refreshTransaction', function () {
    it('should refresh a single out ETH tx', function (done) {
      let stateChanged = false

      const end = once(function (err) {
        if (err) {
          done(err)
        } else if (stateChanged === false) {
          done(new Error('State not changed'))
        } else {
          done()
        }
        explorer.stop()
      })

      const eventBus = new EventEmitter()

      const hash = randomTxId()
      const address = randomAddress()
      const walletId = 1

      const transaction = {
        gasPrice: 0,
        hash,
        value: 0
      }
      const receipt = {
        from: address,
        logs: [],
        to: randomAddress()
      }

      eventBus.on('wallet-error', function (err) {
        end(new Error(err.message))
      })
      eventBus.on('wallet-state-changed', function (data) {
        try {
          data.should.deep.equal({
            [walletId]: {
              addresses: {
                [address]: {
                  transactions: [{
                    meta: {
                      contractCallFailed: false
                    },
                    receipt,
                    transaction
                  }]
                }
              }
            }
          })
          stateChanged = true
        } catch (err) {
          end(err)
        }
      })

      const responses = {
        eth_getBlockByNumber: () => ({ number: 0 }),
        eth_getTransactionByHash (_hash) {
          _hash.should.equal(hash)
          return transaction
        },
        eth_getTransactionReceipt (_hash) {
          _hash.should.equal(hash)
          return receipt
        }
      }
      const plugins = { eth: { web3Provider: new MockProvider(responses) } }

      const { api } = explorer.start({ config, eventBus, plugins })

      eventBus.emit('open-wallets', { activeWallet: walletId })

      api.refreshTransaction(hash, address)
        .then(end)
        .catch(end)
    })

    it('should refresh a single in MET tx', function (done) {
      let stateChanged = false

      const end = once(function (err) {
        if (err) {
          done(err)
        } else if (stateChanged === false) {
          done(new Error('State not changed'))
        } else {
          done()
        }
        explorer.stop()
      })

      const eventBus = new EventEmitter()

      const hash = randomTxId()
      const address = randomAddress()
      const fromAddress = randomAddress()
      const contractAddress = randomAddress()
      const tokenValue = '1'
      const walletId = 1

      const transaction = {
        gasPrice: 0,
        hash,
        value: 0
      }
      const { eth } = web3
      const logs = [{
        transactionHash: hash,
        address: contractAddress,
        data: eth.abi.encodeParameters(['uint256'], [tokenValue]),
        topics: [
          eth.abi.encodeEventSignature('Transfer(address,address,uint256)'),
          eth.abi.encodeParameter('address', fromAddress),
          eth.abi.encodeParameter('address', address)
        ]
      }]
      const receipt = {
        from: fromAddress,
        logs,
        to: contractAddress
      }

      eventBus.on('wallet-error', function (err) {
        end(new Error(err.message))
      })
      eventBus.on('wallet-state-changed', function (data) {
        try {
          data.should.deep.equal({
            [walletId]: {
              addresses: {
                [address]: {
                  transactions: [{
                    meta: {
                      contractCallFailed: false,
                      tokens: {
                        [contractAddress]: {
                          event: 'Transfer',
                          from: fromAddress,
                          to: address,
                          value: tokenValue,
                          processing: false
                        }
                      }
                    },
                    receipt,
                    transaction
                  }]
                }
              }
            }
          })
          stateChanged = true
        } catch (err) {
          end(err)
        }
      })

      const responses = {
        eth_getBlockByNumber: () => ({ number: 0 }),
        eth_getTransactionByHash (_hash) {
          _hash.should.equal(hash)
          return transaction
        },
        eth_getTransactionReceipt (_hash) {
          _hash.should.equal(hash)
          return receipt
        }
      }
      const plugins = { eth: { web3Provider: new MockProvider(responses) } }

      const { api } = explorer.start({ config, eventBus, plugins })

      eventBus.emit('open-wallets', { activeWallet: walletId })

      getEventDataCreators(contractAddress).map(api.registerEvent)

      api.refreshTransaction(hash, address)
        .then(end)
        .catch(end)
    })

    it('should skip refreshing an unconfirmed tx', function (done) {
      const end = once(function (err) {
        done(err)
        explorer.stop()
      })

      const eventBus = new EventEmitter()

      const hash = randomTxId()
      const address = randomAddress()

      const transaction = {
        gasPrice: 0,
        hash,
        value: 0
      }
      const receipt = null

      eventBus.on('wallet-error', function (err) {
        end(new Error(err.message))
      })
      eventBus.on('wallet-state-changed', function () {
        end(new Error('Should not have received an update'))
      })

      const responses = {
        eth_getBlockByNumber: () => ({ number: 0 }),
        eth_getTransactionByHash (_hash) {
          _hash.should.equal(hash)
          return transaction
        },
        eth_getTransactionReceipt (_hash) {
          _hash.should.equal(hash)
          return receipt
        }
      }
      const plugins = { eth: { web3Provider: new MockProvider(responses) } }

      const { api } = explorer.start({ config, eventBus, plugins })

      api.refreshTransaction(hash, address)
        .then(end)
        .catch(end)
    })

    it('should reject on error during refresh', function (done) {
      let stateChanged = false
      let errorFired = false

      const end = once(function (err) {
        if (err) {
          done(err)
        } else if (stateChanged) {
          done(new Error('State changed'))
        } else if (errorFired === false) {
          done(new Error('Error not fired'))
        } else {
          done()
        }
        explorer.stop()
      })

      const eventBus = new EventEmitter()

      const hash = randomTxId()
      const address = randomAddress()
      const toAddress = randomAddress()
      const contractAddress = randomAddress()
      const tokenValue = '1'

      const { eth } = web3
      const logs = [{
        transactionHash: hash,
        address: contractAddress,
        data: eth.abi.encodeParameters(['uint256'], [tokenValue]),
        topics: [
          eth.abi.encodeEventSignature('Transfer(address,address,uint256)'),
          eth.abi.encodeParameter('address', address),
          eth.abi.encodeParameter('address', toAddress)
        ]
      }]
      const receipt = {
        from: address,
        logs,
        to: contractAddress
      }

      eventBus.on('wallet-error', function () {
        errorFired = true
      })
      eventBus.on('wallet-state-changed', function () {
        stateChanged = true
      })

      const responses = {
        eth_getBlockByNumber: () => ({ number: 0 }),
        eth_getTransactionByHash (_hash) {
          _hash.should.equal(hash)
          throw new Error('Fake get transaction error')
        },
        eth_getTransactionReceipt (_hash) {
          _hash.should.equal(hash)
          return receipt
        }
      }
      const plugins = { eth: { web3Provider: new MockProvider(responses) } }

      const { api } = explorer.start({ config, eventBus, plugins })

      getEventDataCreators(contractAddress).map(api.registerEvent)

      api.refreshTransaction(hash, address).should.be.rejectedWith('Fake')
        .then(() => end())
        .catch(end)
    })
  })

  describe('refreshAllTransactions', function () {
    it('should start from birthblock', function (done) {
      const chain = 'ropsten'
      const { birthblock } = MetronomeContracts[chain].Auctions
      const latestBlock = 5000000

      let receivedFromBlock
      let receivedToBlock

      const responses = {
        eth_getBlockByNumber: () => ({ number: latestBlock }),
        eth_getLogs ({ fromBlock, toBlock }) {
          receivedFromBlock = Web3.utils.hexToNumber(fromBlock)
          receivedToBlock = Web3.utils.hexToNumber(toBlock)
          return []
        }
      }

      const eventBus = new EventEmitter()
      const plugins = { eth: { web3Provider: new MockProvider(responses) } }

      const { api } = explorer.start({
        config,
        eventBus,
        plugins
      })

      getEventDataCreator(chain).map(api.registerEvent)

      const end = once(function (err) {
        if (err) {
          done(err)
          return
        }
        try {
          should.equal(receivedFromBlock, birthblock)
          should.equal(receivedToBlock, latestBlock)
          done()
        } catch (err) {
          done(err)
        }
        explorer.stop()
      })

      eventBus.on('wallet-error', function (err) {
        end(new Error(err.message))
      })

      eventBus.once('coin-block', function () {
        api.refreshAllTransactions(randomAddress())
          .then(() => end())
          .catch(end)
      })
    })
  })
})
