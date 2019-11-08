'use strict'

const web3EthAbi = require('web3-eth-abi')

const tryParseEventLog = eventsRegistry => (log, address) =>
  eventsRegistry
    .getAll()
    .map(function(registration) {
      const {
        abi,
        contractAddress,
        eventName,
        filter,
        metaParser
      } = registration(address)

      const eventAbi = abi.find(e => e.type === 'event' && e.name === eventName)

      if (!eventAbi) {
        return null
      }

      const signature = web3EthAbi.encodeEventSignature(eventAbi)

      const data = log.data || (log.raw && log.raw.data)
      const topics = log.topics || (log.raw && log.raw.topics)

      if (log.address !== contractAddress || topics[0] !== signature) {
        return null
      }

      const returnValues = web3EthAbi.decodeLog(
        eventAbi.inputs,
        data,
        eventAbi.anonymous ? topics : topics.slice(1)
      )

      return {
        contractAddress,
        filter,
        metaParser,
        parsed: Object.assign({}, log, {
          event: eventName,
          returnValues,
          signature
        })
      }
    })
    .filter(data => !!data)

module.exports = tryParseEventLog
