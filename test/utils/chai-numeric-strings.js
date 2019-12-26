'use strict'

const integerString = /^[0-9]+$/

function chaiNumericStrings(chai, utils) {
  const { Assertion } = chai

  function setRepresentingFlag() {
    utils.flag(this, 'representing', true)
  }

  function createMethod(_super) {
    return function(type) {
      if (!utils.flag(this, 'representing')) {
        _super.apply(this, arguments)
        return
      }

      // check object is a string
      new Assertion(this._obj).is.a('string')

      // check it represents the proper type
      switch (type) {
        case 'integer':
          this.assert(
            integerString.test(this._obj),
            'expected #{this} to be a string representing an integer',
            'expected #{this} to not be a string representing an integer'
          )
          break
        default:
          _super.apply(this, arguments)
      }
    }
  }

  function createProperty(_super) {
    return function() {
      _super.call(this)
    }
  }

  Assertion.addProperty('represent', setRepresentingFlag)
  Assertion.addProperty('represents', setRepresentingFlag)
  Assertion.overwriteChainableMethod('a', createMethod, createProperty)
  Assertion.overwriteChainableMethod('an', createMethod, createProperty)
}

module.exports = chaiNumericStrings
