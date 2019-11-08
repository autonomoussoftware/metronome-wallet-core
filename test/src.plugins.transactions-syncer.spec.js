'use strict'

const { noop, once } = require('lodash')
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
const EventEmitter = require('events')
const MetronomeContracts = require('metronome-contracts')
const web3EthAbi = require('web3-eth-abi')

const { randomAddress, randomTxId } = require('./utils')

const {
  getEventDataCreator
} = require('../src/plugins/metronome/auction-events')
const { getEventDataCreators } = require('../src/plugins/erc20/events')

const transactionSyncer = require('../src/plugins/transactions-syncer')()

const should = chai.use(chaiAsPromised).should()

describe('Transactions syncer plugin', function() {
  describe('refreshTransaction', function() {
    it('should refresh a single out ETH tx', function(done) {
      let stateChanged = false

      const end = once(function(err) {
        if (err) {
          done(err)
        } else {
          try {
            stateChanged.should.equal(true, 'State not changed')
            done()
          } catch (err) {
            done(err)
          }
        }
        transactionSyncer.stop()
      })

      const address = randomAddress()
      const hash = randomTxId()
      const walletId = 1

      const transaction = {
        gasPrice: 0,
        hash,
        value: 0
      }
      const receipt = {
        blockNumber: 0,
        from: address,
        logs: [],
        to: randomAddress()
      }
      const transactions = [
        {
          meta: {
            contractCallFailed: false
          },
          receipt,
          transaction
        }
      ]

      const config = { useNativeCookieJar: true }

      const eventBus = new EventEmitter()
      eventBus.on('wallet-error', function(err) {
        end(new Error(err.message))
      })
      eventBus.on('wallet-state-changed', function(data) {
        try {
          data.should.deep.equal({
            [walletId]: {
              addresses: {
                [address]: {
                  transactions
                }
              }
            }
          })
          stateChanged = true
        } catch (err) {
          end(err)
        }
      })

      const plugins = {
        explorer: {
          getTransactionReceipt(_hash) {
            _hash.should.equal(hash)
            return Promise.resolve(receipt)
          }
        },
        transactionsList: {
          addTransaction(_address) {
            _address.should.equal(address)
            return function(_hash) {
              _hash.should.equal(hash)
              eventBus.emit('wallet-state-changed', {
                [walletId]: {
                  addresses: {
                    [address]: {
                      transactions
                    }
                  }
                }
              })
              return { promise: Promise.resolve() }
            }
          }
        }
      }

      const { api } = transactionSyncer.start({ config, eventBus, plugins })

      eventBus.emit('open-wallets', { activeWallet: walletId })

      api
        .refreshTransaction(hash, address)
        .then(noop)
        .then(end)
        .catch(end)
    })

    it('should refresh a single in MET tx', function(done) {
      let stateChanged = false

      const end = once(function(err) {
        if (err) {
          done(err)
        } else {
          try {
            stateChanged.should.equal(true, 'State not changed')
            done()
          } catch (err) {
            done(err)
          }
        }
        transactionSyncer.stop()
      })

      const address = randomAddress()
      const contractAddress = randomAddress()
      const fromAddress = randomAddress()
      const hash = randomTxId()
      const tokenValue = '1'
      const walletId = 1
      const transaction = {
        gasPrice: 0,
        hash,
        value: 0
      }
      const logs = [
        {
          transactionHash: hash,
          address: contractAddress,
          data: web3EthAbi.encodeParameters(['uint256'], [tokenValue]),
          topics: [
            web3EthAbi.encodeEventSignature(
              'Transfer(address,address,uint256)'
            ),
            web3EthAbi.encodeParameter('address', fromAddress),
            web3EthAbi.encodeParameter('address', address)
          ]
        }
      ]
      const receipt = {
        blockNumber: 0,
        from: fromAddress,
        logs,
        to: contractAddress
      }
      const transactions = [
        {
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
        }
      ]

      const config = { useNativeCookieJar: true }

      const eventBus = new EventEmitter()
      eventBus.on('wallet-error', function(err) {
        end(new Error(err.message))
      })
      eventBus.on('wallet-state-changed', function(data) {
        try {
          data.should.deep.equal({
            [walletId]: {
              addresses: {
                [address]: {
                  transactions
                }
              }
            }
          })
          stateChanged = true
        } catch (err) {
          end(err)
        }
      })

      const plugins = {
        explorer: {
          getTransactionReceipt(_hash) {
            _hash.should.equal(hash)
            return Promise.resolve(receipt)
          }
        },
        transactionsList: {
          addEvent(_address) {
            _address.should.equal(address)
            return function(event) {
              event.address.should.equal(contractAddress)
              event.event.should.equal('Transfer')
              event.returnValues._from.should.equal(fromAddress)
              event.returnValues._to.should.equal(address)
              event.returnValues._value.should.equal(tokenValue)
              eventBus.emit('wallet-state-changed', {
                [walletId]: {
                  addresses: {
                    [address]: {
                      transactions
                    }
                  }
                }
              })
              return Promise.resolve()
            }
          }
        }
      }

      const { api } = transactionSyncer.start({ config, eventBus, plugins })

      eventBus.emit('open-wallets', { activeWallet: walletId })

      getEventDataCreators(contractAddress).map(api.registerEvent)

      api
        .refreshTransaction(hash, address)
        .then(noop)
        .then(end)
        .catch(end)
    })

    it('should skip refreshing an unconfirmed tx', function(done) {
      const end = once(function(err) {
        done(err)
        transactionSyncer.stop()
      })

      const address = randomAddress()
      const hash = randomTxId()
      const receipt = null

      const config = { useNativeCookieJar: true }

      const eventBus = new EventEmitter()
      eventBus.on('wallet-error', function(err) {
        end(new Error(err.message))
      })
      eventBus.on('wallet-state-changed', function() {
        end(new Error('Should not have received an update'))
      })

      const plugins = {
        explorer: {
          getTransactionReceipt(_hash) {
            _hash.should.equal(hash)
            return Promise.resolve(receipt)
          }
        }
      }

      const { api } = transactionSyncer.start({ config, eventBus, plugins })

      api
        .refreshTransaction(hash, address)
        .then(noop)
        .then(end)
        .catch(end)
    })

    it('should reject on error during refresh', function(done) {
      let stateChanged = false
      let errorFired = false

      const end = once(function(err) {
        if (err) {
          done(err)
        } else {
          try {
            stateChanged.should.equal(false, 'State changed')
            errorFired.should.equal(true, 'Error not fired')
            done()
          } catch (err) {
            done(err)
          }
        }
        transactionSyncer.stop()
      })

      const address = randomAddress()
      const contractAddress = randomAddress()
      const hash = randomTxId()
      const toAddress = randomAddress()
      const tokenValue = '1'
      const logs = [
        {
          transactionHash: hash,
          address: contractAddress,
          data: web3EthAbi.encodeParameters(['uint256'], [tokenValue]),
          topics: [
            web3EthAbi.encodeEventSignature(
              'Transfer(address,address,uint256)'
            ),
            web3EthAbi.encodeParameter('address', address),
            web3EthAbi.encodeParameter('address', toAddress)
          ]
        }
      ]
      const receipt = {
        blockNumber: 0,
        from: address,
        logs,
        to: contractAddress
      }

      const config = { useNativeCookieJar: true }

      const eventBus = new EventEmitter()
      eventBus.on('wallet-error', function() {
        errorFired = true
      })
      eventBus.on('wallet-state-changed', function() {
        stateChanged = true
      })

      const plugins = {
        explorer: {
          getTransactionReceipt(_hash) {
            _hash.should.equal(hash)
            return Promise.resolve(receipt)
          }
        },
        transactionsList: {
          addEvent(_address) {
            _address.should.equal(address)
            return function(event) {
              event.address.should.equal(contractAddress)
              event.event.should.equal('Transfer')
              event.returnValues._from.should.equal(address)
              event.returnValues._to.should.equal(toAddress)
              event.returnValues._value.should.equal(tokenValue)
              return Promise.resolve()
            }
          },
          addTransaction(_address) {
            _address.should.equal(address)
            return function(_hash) {
              _hash.should.equal(hash)
              const err = new Error('Fake get transaction error')
              eventBus.emit('wallet-error', {
                inner: err,
                message: 'Could not emit event transaction',
                meta: { plugin: 'explorer' }
              })
              return {
                promise: Promise.reject(err)
              }
            }
          }
        }
      }

      const { api } = transactionSyncer.start({ config, eventBus, plugins })

      getEventDataCreators(contractAddress).map(api.registerEvent)

      api
        .refreshTransaction(hash, address)
        .should.be.rejectedWith('Fake')
        .then(() => end())
        .catch(end)
    })
  })

  describe('refreshAllTransactions', function() {
    it('should start from birthblock', function(done) {
      const chain = 'ropsten'
      const { birthblock } = MetronomeContracts[chain].Auctions
      const latestBlock = 5000000

      let receivedFromBlock
      let receivedToBlock

      const end = once(function(err) {
        if (err) {
          done(err)
        } else {
          try {
            should.equal(receivedFromBlock, birthblock)
            should.equal(receivedToBlock, latestBlock)
            done()
          } catch (err) {
            done(err)
          }
        }
        transactionSyncer.stop()
      })

      const config = { symbol: 'TEST', useNativeCookieJar: true }

      const eventBus = new EventEmitter()
      eventBus.on('wallet-error', function(err) {
        end(new Error(err.message))
      })

      const plugins = {
        explorer: {
          getPastEvents(a, c, e, { fromBlock, toBlock }) {
            receivedFromBlock = fromBlock
            receivedToBlock = toBlock
            return Promise.resolve([])
          },
          getTransactions(fromBlock, toBlock) {
            fromBlock.should.equal(0)
            toBlock.should.equal(latestBlock)
            return Promise.resolve([])
          }
        },
        transactionsList: {
          addEvent: () => noop,
          addTransaction: () => noop
        }
      }

      const { api } = transactionSyncer.start({ config, eventBus, plugins })

      getEventDataCreator(chain).map(api.registerEvent)

      api
        .refreshAllTransactions(randomAddress())
        .then(noop)
        .then(end)
        .catch(end)

      eventBus.emit('coin-block', { number: latestBlock })
    })
  })
})
