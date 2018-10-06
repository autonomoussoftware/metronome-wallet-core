'use strict'

const { once } = require('lodash')
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
const EventEmitter = require('events')
const Web3 = require('web3')

const MockProvider = require('./utils/mock-provider')
const { randomAddress, randomTxId } = require('./utils')

chai.use(chaiAsPromised).should()

const explorer = require('../src/plugins/explorer')
const config = { debug: true, explorer: { debuounce: 100 } }
const web3 = new Web3()

describe('Explorer plugin', function () {
  it('should refresh a single out ETH tx', function (done) {
    let stateChanged = false

    const end = once(function (err) {
      if (err) {
        done(err)
        return
      }
      if (!stateChanged) {
        done(new Error('State not changed'))
        return
      }
      explorer.stop()
      done()
    })

    const eventBus = new EventEmitter()

    const hash = randomTxId()
    const address = randomAddress()

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
          1: {
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

    api.refreshTransaction(hash, address)
      .then(end)
      .catch(end)
  })

  it('should refresh a single in MET tx', function (done) {
    let stateChanged = false

    const end = once(function (err) {
      if (err) {
        done(err)
        return
      }
      if (!stateChanged) {
        done(new Error('State not changed'))
        return
      }
      explorer.stop()
      done()
    })

    const eventBus = new EventEmitter()

    const hash = randomTxId()
    const address = randomAddress()
    const fromAddress = randomAddress()
    const contractAddress = randomAddress()
    const tokenValue = '1'

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
          1: {
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

    const { getEventDataCreators } = require('../src/plugins/tokens/events')

    getEventDataCreators(contractAddress).map(api.registerEvent)

    api.refreshTransaction(hash, address)
      .then(end)
      .catch(end)
  })
})
