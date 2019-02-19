'use strict'

const proxyquire = require('proxyquire').noPreserveCache().noCallThru()
require('chai').should()

const burnHashes = new Array(32).fill()
  .map((_, i) => i)
  .reduce(
    (all, i) =>
      Object.assign(all, { [i]: `0x${i < 16 ? '0' : ''}${i.toString(16)}` }),
    {}
  )

const MockMetronomeContracts = function () {
  this.TokenPorter = {
    methods: {
      exportedBurns: seq => ({
        call: () => Promise.resolve(burnHashes[seq])
      })
    }
  }
}

const MockMerkleJs = function (leaves) {
  this.leaves = leaves
}
MockMerkleJs.prototype.getRoot = function () {
  return Buffer.concat(this.leaves)
}

const porterApi = proxyquire('../src/plugins/metronome/porter-api', {
  'merkletreejs': MockMerkleJs,
  'metronome-contracts': MockMetronomeContracts
})

const getMerkleRoot = porterApi.getMerkleRoot({}, 'chain')

describe('TokenPorter API', function () {
  it('should return the root of the last 16 burn hashes', () =>
    getMerkleRoot('24')
      .then(function (root) {
        root.should.equal('0x090a0b0c0d0e0f101112131415161718')
      })
  )

  it('should return the root of the last 10 burn hashes', () =>
    getMerkleRoot('8')
      .then(function (root) {
        root.should.equal('0x000102030405060708')
      })
  )
})
