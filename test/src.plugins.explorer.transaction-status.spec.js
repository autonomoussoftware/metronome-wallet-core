'use strict'

const chai = require('chai')

const getStatus = require('../src/plugins/explorer/transaction-status')

const should = chai.should()

describe('Transaction status', function () {
  it('should report success status', function () {
    getStatus({}, { status: true }).should.equal(true)
  })

  it('should report failure status', function () {
    getStatus({}, { status: false }).should.equal(false)
  })

  it('should report success status on pre-Byzantine fork', function () {
    let gas, input, logs

    // not a contract call
    input = '0x'
    gas = 1
    logs = []
    getStatus({ input, gas }, { gasUsed: 1, logs, status: null })
      .should.equal(true)

    // there are logs
    input = '0x00'
    gas = 1
    logs = [{}]
    getStatus({ input, gas }, { gasUsed: 1, logs, status: null })
      .should.equal(true)

    // not all gas was used
    input = '0x00'
    gas = 2
    logs = []
    getStatus({ input, gas }, { gasUsed: 1, logs, status: null })
      .should.equal(true)
  })

  it('should report failure status on pre-Byzantine fork', function () {
    getStatus({ input: '0x00', gas: 1 }, { gasUsed: 1, logs: [], status: null })
      .should.equal(false)
  })

  it('should throw if no receipt is provided', function () {
    should.Throw(() => getStatus(), 'No transaction receipt')
  })
})
