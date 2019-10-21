'use strict'

const { once } = require('lodash')
require('chai').should()
require('dotenv').config()

const createCore = require('..')

describe('Core E2E', function () {
  // eslint-disable-next-line mocha/no-hooks-for-single-case
  before(function () {
    if (!process.env.E2E) {
      this.skip()
    }
  })

  it('should initialize a core for Ethereum', function (done) {
    const end = once(done)

    const core = createCore()
    const config = {
      indexerUrl: process.env.ROPSTEN_INDEXER,
      wsApiUrl: process.env.ROPSTEN_NODE
    }
    const { api, emitter, events } = core.start(config)

    emitter.on('error', function (err) {
      end(err)
    })
    emitter.on('wallet-error', function (err) {
      end(new Error(err.message))
    })
    emitter.on('coin-block', function (blockHeader) {
      api.should.be.an('object')
      events.should.be.an('array')
      blockHeader.should.be.an('object')

      core.stop()
      end()
    })
  })
})
