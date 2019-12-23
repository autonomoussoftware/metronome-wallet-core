'use strict'

const { seed, qtumAddress } = require('./fixtures/secrets.json')

const qtumWallet = require('../src/plugins/qtum-wallet')()

describe('Qtum wallet', function() {
  it('should return the Qtum address', function() {
    const config = { chainId: 1364481358 }

    const plugins = {
      web3: { qtum: {} },
      transactionsList: {}
    }

    const { api } = qtumWallet.start({ config, plugins })

    api.createAddress(seed).should.equal(qtumAddress)
  })
})
