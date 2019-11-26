'use strict'

const { identity } = require('lodash')
const qtumjslib = require('qtumjs-lib')

function createUtils(chainId) {
  function getQtumAddressSync(address) {
    return qtumjslib.address.toBase58Check(
      Buffer.from(address, 'hex'),
      qtumjslib.networks[chainId === 'test' ? 'qtum_testnet' : 'qtum']
        .pubKeyHash
    )
  }

  function getHexAddressSync(address) {
    return qtumjslib.address.fromBase58Check(address).hash.toString('hex')
  }

  const getHexAddress = address => Promise.resolve(getHexAddressSync(address))

  function parseReturnValues(returnValues, eventAbi) {
    eventAbi.inputs.forEach(function(input) {
      if (input.type !== 'address') {
        return
      }
      returnValues[input.name] = getQtumAddressSync(
        returnValues[input.name].substr(2)
      )
    })
    return returnValues
  }

  return {
    getHexAddress,
    getHexAddressSync,
    getQtumAddressSync,
    parseReturnValues,
    toChecksumAddress: identity
  }
}

module.exports = createUtils
