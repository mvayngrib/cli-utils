
module.exports = {
  genUser: require('./genUser'),
  toJSONForConsole: toJSONForConsole
}

function toJSONForConsole (obj) {
  return JSON.stringify(obj, replacer, 2)
}

function replacer (key, val) {
  if (Buffer.isBuffer(val)) {
    return val.toString('hex')
  }

  if (val == null) return val

  if (Object.keys(val).length === 2 && val.type === 'Buffer' && Array.isArray(val.data)) {
    return replacer(key, new Buffer(val.data))
  }

  if (typeof val === 'object') {
    return val
  }

  return val
}
