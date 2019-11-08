'use strict'

const { noop, once } = require('lodash')
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
const EventEmitter = require('events')

const { randomAddress, randomTxId } = require('./utils')

const transactionsList = require('../src/plugins/transactions-list')()

chai.use(chaiAsPromised).should()

describe('Transactions list plugin', function() {
  it('should queue a PromiEvent', function(done) {
    let hashReceived = false
    let receiptReceived = false
    let promiseResolved = false

    const end = once(function(err) {
      if (err) {
        done(err)
      } else {
        try {
          hashReceived.should.equal(true, 'Transaction hash not received')
          receiptReceived.should.equal(true, 'Receipt not received')
          promiseResolved.should.equal(true, 'Promise not resolved')
          done()
        } catch (err) {
          // ignore error
        }
      }
      transactionsList.stop()
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
      from: address,
      logs: [],
      to: randomAddress(),
      transactionHash: hash
    }
    // TODO try replacing by an actual PromiEvent
    const promiEvent = new EventEmitter()
    // @ts-ignore
    promiEvent.catch = noop

    const eventBus = new EventEmitter()
    eventBus.on('wallet-error', function(err) {
      end(new Error(err.message))
    })
    eventBus.on('wallet-state-changed', function(_data) {
      const data = {
        [walletId]: {
          addresses: {
            [address]: {
              transactions: [
                {
                  transaction,
                  receipt: null,
                  meta: {}
                }
              ]
            }
          }
        }
      }
      if (hashReceived) {
        data[walletId].addresses[address].transactions[0].receipt = receipt
        data[walletId].addresses[address].transactions[0].meta = {
          contractCallFailed: false
        }
      }
      try {
        _data.should.deep.equal(data)
        if (hashReceived) {
          receiptReceived = true
          end()
        } else {
          hashReceived = true
          promiEvent.emit('receipt', receipt)
        }
      } catch (err) {
        end(err)
      }
    })

    const plugins = {
      explorer: {
        getTransaction(_hash) {
          _hash.should.equal(hash)
          return Promise.resolve(transaction)
        },
        getTransactionReceipt(_hash) {
          _hash.should.equal(hash)
          return Promise.resolve(hashReceived ? receipt : null)
        }
      }
    }

    const { api } = transactionsList.start({ config: {}, eventBus, plugins })

    eventBus.emit('open-wallets', { activeWallet: walletId })

    api
      .logTransaction(promiEvent, address)
      .then(function({ receipt: _receipt }) {
        _receipt.should.deep.equal(receipt)
        promiseResolved = true
      })
      .catch(end)

    promiEvent.emit('transactionHash', hash)
  })

  describe('logTransaction', function() {
    it('should queue a promise', function(done) {
      let receiptReceived = false
      let promiseResolved = false

      const end = once(function(err) {
        if (err) {
          done(err)
        } else {
          try {
            receiptReceived.should.equal(true, 'Receipt not received')
            promiseResolved.should.equal(true, 'Promise not resolved')
            done()
          } catch (err) {
            // ignore error
          }
        }
        transactionsList.stop()
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
        from: address,
        logs: [],
        to: randomAddress(),
        transactionHash: hash
      }
      const promise = Promise.resolve(receipt)

      const eventBus = new EventEmitter()
      eventBus.on('wallet-error', function(err) {
        end(new Error(err.message))
      })
      eventBus.on('wallet-state-changed', function(_data) {
        try {
          _data.should.deep.equal({
            [walletId]: {
              addresses: {
                [address]: {
                  transactions: [
                    {
                      transaction,
                      receipt,
                      meta: {
                        contractCallFailed: false
                      }
                    }
                  ]
                }
              }
            }
          })
          receiptReceived = true
          end()
        } catch (err) {
          end(err)
        }
      })

      const plugins = {
        explorer: {
          getTransaction(_hash) {
            _hash.should.equal(hash)
            return Promise.resolve(transaction)
          },
          getTransactionReceipt(_hash) {
            _hash.should.equal(hash)
            return Promise.resolve(receipt)
          }
        }
      }

      const { api } = transactionsList.start({ config: {}, eventBus, plugins })

      eventBus.emit('open-wallets', { activeWallet: walletId })

      api
        .logTransaction(promise, address)
        .then(function({ receipt: _receipt }) {
          _receipt.should.deep.equal(receipt)
          promiseResolved = true
        })
        .catch(end)
    })
  })
})
