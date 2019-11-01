'use strict'

const { CookieJar } = require('tough-cookie')
const { create: createAxios } = require('axios').default
const { default: axiosCookieJarSupport } = require('axios-cookiejar-support')

/**
 * Create an API object to access the HTTP endpoints of the explorer.
 *
 * @param {CoreConfig} config The configuration options.
 * @returns {object} The endpoints.
 */
function createHttpApi(config) {
  const { explorerUrl, useNativeCookieJar } = config

  // Create cookiejar and axios

  const jar = new CookieJar()
  const axios = useNativeCookieJar
    ? createAxios({
        baseURL: explorerUrl
      })
    : axiosCookieJarSupport(
        createAxios({
          baseURL: explorerUrl,
          jar,
          withCredentials: true
        })
      )

  const getCookie = () => jar.getCookiesSync(explorerUrl).join(';')

  // Define explorer access functions

  const getAddressBalance = address =>
    axios(`/api/address/${address}/balance`).then(res => res.data.toString())
  const getAddressQrc20Balance = (contractAddress, address) =>
    axios(`/api/address/${address}`)
      .then(res =>
        res.data.qrc20Balances.find(
          balance => balance.addressHex === contractAddress
        )
      )
      .then(balance => (balance ? balance.balance : '0'))
  const getBlock = hashOrNumber =>
    axios(`/api/block/${hashOrNumber}`).then(res => res.data)
  const getInfo = () => axios('/api/info').then(res => res.data)
  const getMinGasPrice = () =>
    getInfo().then(info => ({ gasPrice: info.dgpInfo.minGasPrice.toString() }))

  const getTransaction = (hash, ethFormat) =>
    axios(`/api/tx/${hash}`)
      .then(res => res.data)
      .then(function(tx) {
        return ethFormat
          ? {
              blockHash: tx.blockHash,
              blockNumber: tx.blockHeight,
              from: tx.inputs[0].address,
              fees: tx.fees,
              hash: tx.hash,
              to: tx.outputs[0].address,
              value: tx.outputs[0].value
            }
          : tx
      })
  const getTransactionReceipt = (hash, ethFormat) =>
    getTransaction(hash).then(function(tx) {
      return Object.assign(
        ethFormat
          ? {
              blockHash: tx.blockHash,
              blockNumber: tx.blockHeight,
              from: tx.inputs[0].address,
              logs: [],
              status: true,
              to: tx.outputs[0].address,
              transactionHash: tx.hash
            }
          : {},
        tx.outputs[0].receipt
      )
    })
  const getTransactions = (fromBlock, toBlock, address) =>
    axios(`/api/address/${address}/txs`, { params: { fromBlock, toBlock } })
      .then(res => res.data)
      .then(data => data.transactions) // TODO consider pagination

  return {
    getAddressBalance,
    getAddressQrc20Balance,
    getBlock,
    getCookie,
    getInfo,
    getMinGasPrice,
    getTransaction,
    getTransactionReceipt,
    getTransactions
  }
}

module.exports = createHttpApi
