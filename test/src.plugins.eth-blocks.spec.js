'use strict'

const { once, pick } = require('lodash')
const EventEmitter = require('events')

const ethBlocks = require('../src/plugins/eth-blocks')()

const ethBlock666 = require('./fixtures/eth-block-666.json')
const MockProvider = require('./utils/mock-provider')

describe('Ethereum blocks plugin', function () {
  it('should emit an Ethereum block on start', function (done) {
    const end = once(done)

    const config = { chainId: 3, chainType: 'ethereum', symbol: 'ETH' }

    const eventBus = new EventEmitter()
    eventBus.on('wallet-error', function (err) {
      end(new Error(err.message))
    })
    eventBus.on('coin-block', function (latest) {
      try {
        latest.should.deep.equal(
          pick(ethBlock666, ['hash', 'number', 'timestamp'])
        )
        end()
      } catch (err) {
        end(err)
      }
    })

    const responses = {
      eth_getBlockByNumber (tag) {
        tag.should.equal('latest')
        return ethBlock666
      },
      eth_subscribe: () => ''
    }
    const plugins = {
      eth: { web3Provider: new MockProvider(responses) }
    }

    ethBlocks.start({ config, eventBus, plugins })
  })
})
