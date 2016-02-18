
const test = require('tape')
const typeforce = require('typeforce')
const constants = require('@tradle/constants')
const genUser = require('../genUser')

test('genUser', function (t) {
  genUser({ networkName: 'testnet' }, function (err, user) {
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
