'use strict'

const { create } = require('axios')
const { default: axiosCookieJarSupport } = require('axios-cookiejar-support')

function createAxiosCookiejar (options, jar) {
  const axios = create(Object.assign(
    {},
    options,
    { jar, withCredentials: true }
  ))

  axiosCookieJarSupport(axios)

  return axios
}

module.exports = createAxiosCookiejar
