
const test = require('tape')
const typeforce = require('typeforce')
const constants = require('@tradle/constants')
const utils = require('../')

test('genUser', function (t) {
  utils.genUser({ networkName: 'testnet' }, function (err, user) {
    if (err) throw err

    typeforce({
      [constants.CUR_HASH]: 'String',
      [constants.ROOT_HASH]: 'String',
      pub: 'Object',
      priv: 'Array'
    }, user)

    t.end()
  })
})

test('json minus bufs', function (t) {
  const str = utils.toJSONForConsole({ a: new Buffer('abcd', 'hex') })
  t.equal(str, '{\n  "a": "abcd"\n}')
  t.end()
})
