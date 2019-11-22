'use strict'

const { CookieJar } = require('tough-cookie')
const { create: createAxios } = require('axios').default
const { default: axiosCookieJarSupport } = require('axios-cookiejar-support')
const { encodeMethod } = require('qtumjs-ethjs-abi')
const { padStart } = require('lodash')
const parseContractLogs = require('metronome-sdk/src/parse-logs')
const web3EthAbi = require('web3-eth-abi')

/**
 * Create an API object to access the HTTP endpoints of the explorer.
 *
 * @param {CoreConfig} config The configuration options.
 * @returns {object} The endpoints.
 */
function createHttpApi(config) {
  const { explorerApiUrl, useNativeCookieJar } = config

  // Create cookiejar and axios

  const jar = new CookieJar()
  const axios = useNativeCookieJar
    ? createAxios({
        baseURL: explorerApiUrl
      })
    : axiosCookieJarSupport(
        createAxios({
          baseURL: explorerApiUrl,
          jar,
          withCredentials: true
        })
      )

  const getCookie = () => jar.getCookiesSync(explorerApiUrl).join(';')

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

  const getTransaction = (hash, address) =>
    axios(`/api/tx/${hash}`)
      .then(res => res.data)
      .then(function(tx) {
        const txInput = tx.inputs[0]
        const txOutput =
          txInput.address === address
            ? tx.outputs[0]
            : tx.outputs.find(o => o.address === address) ||
              tx.outputs.find(o => o.receipt)
        return {
          blockHash: tx.blockHash,
          blockNumber: tx.blockHeight,
          from: txInput.address,
          fees: tx.fees,
          hash: tx.hash,
          isRefund: txOutput.isRefund,
          to: txOutput.address,
          receipt: txOutput.receipt || { excepted: 'None' },
          value: txOutput.value
        }
      })
  const getTransactionReceipt = (hash, address) =>
    getTransaction(hash, address).then(function(tx) {
      return Object.assign(
        {
          blockHash: tx.blockHash,
          blockNumber: tx.blockNumber,
          from: tx.from,
          logs: [],
          status: tx.receipt.excepted === 'None',
          to: tx.to,
          transactionHash: tx.hash
        },
        tx.receipt
      )
    })
  const getTransactions = (fromBlock, toBlock, address) =>
    axios(`/api/address/${address}/txs`, { params: { fromBlock, toBlock } })
      .then(res => res.data)
      .then(data => data.transactions) // TODO consider pagination

  const getQrc20TransferGasLimit = (abi, { qtumRPC }, gasOverestimation) => ({
    token,
    to,
    from,
    value
  }) =>
    qtumRPC
      .getHexAddress(to)
      .then(_to =>
        axios(`/api/contract/${token}/call`, {
          params: {
            sender: from,
            data: encodeMethod(
              abi.find(d => d.name === 'transfer' && d.type === 'function'),
              [_to, value]
            )
          }
        })
      )
      .then(res => res.data)
      .then(function(data) {
        if (data.executionResult.excepted !== 'None') {
          throw new Error('The execution failed due to an exception')
        }
        return {
          gasLimit: Math.round(data.executionResult.gasUsed * gasOverestimation)
        }
      })

  const getPastEvents = coin =>
    function(abi, contractAddress, eventName, options) {
      const { fromBlock, toBlock, filter } = options

      const params = { contract: contractAddress, fromBlock, toBlock }

      const descriptor = abi.find(
        d => d.type === 'event' && d.name === eventName
      )
      params.topic1 = web3EthAbi.encodeEventSignature(descriptor).substr(2)

      const topics = descriptor.inputs.filter(i => i.indexed)
      topics.forEach(function(topic, i) {
        const filterValue = filter[topic.name]
        if (!filterValue) {
          return
        }
        params[`topic${i + 2}`] =
          topic.type === 'address'
            ? padStart(coin.getHexAddressSync(filterValue), 64, '0')
            : filterValue
      })

      return axios('/api/searchlogs', {
        params
      })
        .then(res => res.data)
        .then(data =>
          data.logs
            .map(log =>
              parseContractLogs(
                {
                  options: {
                    address: contractAddress,
                    jsonInterface: abi
                  }
                },
                {
                  logs: [{ ...log, transactionHash: log.transactionId }]
                }
              )
            )
            .map(receipt => receipt.logs[0])
            .map(log => ({
              ...log,
              returnValues: coin.parseReturnValues(log.returnValues, descriptor)
            }))
        )
    }

  return {
    getAddressBalance,
    getAddressQrc20Balance,
    getBlock,
    getCookie,
    getInfo,
    getMinGasPrice,
    getPastEvents,
    getQrc20TransferGasLimit,
    getTransaction,
    getTransactionReceipt,
    getTransactions
  }
}

module.exports = createHttpApi
