'use strict'

const { once } = require('lodash')
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
const EventEmitter = require('events')
const Web3 = require('web3')

const MockProvider = require('./utils/mock-provider')
const { randomAddress, randomTxId } = require('./utils')

chai.use(chaiAsPromised).should()

const explorer = require('../src/plugins/explorer').create()
const config = { debug: true, explorer: { debuounce: 100 } }
const web3 = new Web3()

describe('Explorer plugin', function () {
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
      eth_getBlockByNumber: () => 0,
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
    const logs = [{
      transactionHash: hash,
      address: contractAddress,
      data: web3.eth.abi.encodeParameters(['uint256'], [tokenValue]),
      topics: [
        web3.eth.abi.encodeEventSignature('Transfer(address,address,uint256)'),
        web3.eth.abi.encodeParameter('address', fromAddress),
        web3.eth.abi.encodeParameter('address', address)
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
      eth_getBlockByNumber: () => 0,
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

    const { getEventDataCreators } = require('../src/plugins/tokens/events')

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
      eth_getBlockByNumber: () => 0,
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

  it('should return a rejected promise if an error happens', function (done) {
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

    const logs = [{
      transactionHash: hash,
      address: contractAddress,
      data: web3.eth.abi.encodeParameters(['uint256'], [tokenValue]),
      topics: [
        web3.eth.abi.encodeEventSignature('Transfer(address,address,uint256)'),
        web3.eth.abi.encodeParameter('address', address),
        web3.eth.abi.encodeParameter('address', toAddress)
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
      eth_getBlockByNumber: () => 0,
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

    const { getEventDataCreators } = require('../src/plugins/tokens/events')

    getEventDataCreators(contractAddress).map(api.registerEvent)

    api.refreshTransaction(hash, address).should.be.rejectedWith('Fake')
      .then(() => end())
      .catch(end)
  })
})
