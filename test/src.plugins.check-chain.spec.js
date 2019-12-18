'use strict'

const { once } = require('lodash')
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
const EventEmitter = require('events')

const checkChain = require('../src/plugins/check-chain')()

chai.use(chaiAsPromised).should()

const mockWeb3 = ({ id }) => ({
  eth: {
    getChainId: () => Promise.resolve(id)
  }
})

describe('Chain checker', function() {
  it('should not emit an error if the chain is correct', function(done) {
    const end = once(done)

    const config = { chainId: 3, chainType: 'ethereum', symbol: 'ETH' }

    const eventBus = new EventEmitter()
    eventBus.on('wallet-error', function(err) {
      end(new Error(err.message))
    })

    const plugins = {
      coin: { web3: mockWeb3({ id: 3 }) }
    }

    checkChain.start({ config, eventBus, plugins })
    setTimeout(end, 50)
  })

  it('should emit an error if the chain does not match', function(done) {
    const end = once(done)

    const config = { chainId: 3, chainType: 'ethereum', symbol: 'ETH' }

    const eventBus = new EventEmitter()
    eventBus.on('wallet-error', function(err) {
      end(err.message.includes('Wrong chain') ? null : new Error(err.message))
    })

    const plugins = {
      coin: { web3: mockWeb3({ id: 1 }) }
    }

    checkChain.start({ config, eventBus, plugins })
    setTimeout(function() {
      end(new Error('No error emitted'))
    }, 50)
  })
})
