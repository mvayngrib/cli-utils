'use strict'

const prompt = require('prompt')
const constants = require('@tradle/engine').constants
const ALGORITHM = 'aes-256-cbc'
const SALT_BYTES = 32
const IV_BYTES = 16
const KEY_BYTES = 32
const ITERATIONS = 20000
const DIGEST = 'sha256'
const TYPE = constants.TYPE
const utils = exports

utils.toJSONForConsole = function toJSONForConsole (obj) {
  return JSON.stringify(obj, replacer, 2)
}

utils.promptBuildMsg = function promptBuildMsg (prompter, models) {
  return prompter.prompt([
    {
      type: 'input',
      name: 'type',
      message: 'type (tradle.SimpleMessage) ',
      default: 'tradle.SimpleMessage'
    }
  ])
  .then((result) => {
    const msg = {
      [TYPE]: result.type
    }

    const model = models[msg[TYPE]]
    return model ? setPropertiesWithModel(prompter, model, msg) : setPropertiesNoModel(prompter, msg)
  })
}

utils.signNSend = function signNSend (prompter, tim, opts) {
  let object = opts.object
  if (!tim._promisified) {
    throw new Error('expected promisified node')
  }

  return tim.sign({ object })
    .then(result => previewSend(prompter, result.object))
    .then(object => {
      opts.object = object
      return tim.send(opts)
    })
    .then(result => {
      prompter.log('message queued')
      const link = result.link
      tim.on('sent', sentHandler)

      function sentHandler (msg) {
        if (msg.link === link) {
          prompter.log(`delivered ${object[TYPE] || 'untyped message'} with link ${link}`)
          tim.removeListener('sent', sentHandler)
        }
      }
    })
}

utils.previewSend = function previewSend (prompter, msg) {
  let json = Buffer.isBuffer(msg)
    ? JSON.parse(msg.toString())
    : msg

  return prompter.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `About to sign and send \n${toJSONForConsole(json)}\n\nIs this OK? (yes)`,
      default: true
    }
  ])
  .then((result) => {
    if (!result.confirm) {
      throw new Error('send aborted')
    }

    return msg
  })
}

utils.encrypt = function encrypt (data, password) {
  const salt = crypto.randomBytes(SALT_BYTES)
  const iv = crypto.randomBytes(IV_BYTES)
  const key = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_BYTES, DIGEST)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(data), cipher.final()])
  return Buffer.concat([
    salt,
    iv,
    ciphertext
  ])
}

utils.decrypt = function decrypt (data, password) {
  const salt = data.slice(0, SALT_BYTES)
  const iv = data.slice(SALT_BYTES, SALT_BYTES + IV_BYTES)
  const ciphertext = data.slice(SALT_BYTES + IV_BYTES)
  const key = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_BYTES, DIGEST)
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString()
}

utils.promptPassAndDecrypt = function promptPassAndDecrypt (ciphertext, maxTries, cb) {
  promptPassAndOp('decrypt', ciphertext, maxTries, cb)
}

utils.promptPassAndEncrypt = function promptPassAndDecrypt (plaintext, maxTries, cb) {
  promptPassAndOp('encrypt', plaintext, maxTries, cb)
}

function promptPassAndOp(op, data, triesLeft, cb) {
  if (typeof triesLeft === 'function') {
    cb = triesLeft
    triesLeft = 1
  }

  if (!triesLeft) return cb(new Error('incorrect password'))

  prompt.get(['password'], function (err, answer) {
    if (err) throw err

    let result
    try {
      result = utils[op](data, answer.password)
    } catch (err) {
      return promptPassAndOp(op, data, --triesLeft, cb)
    }

    cb(null, result, answer.password)
  })
}

function setPropertiesWithModel (prompter, model, msg) {
  let required = model.required || Object.keys(model.properties)
  required = required.filter(p => {
    return p !== 'from' && p !== 'to' && p !== 'photos' && !(p in msg)
  })

  if (!required.length) return Q(msg)

  const next = required.pop()
  return prompter.prompt([
    {
      type: 'input',
      name: 'value',
      message: `${next}: `
    }
  ])
  .then(result => {
    msg[next] = result.value
    return setPropertiesWithModel(prompter, model, msg)
  })
}

function setPropertiesNoModel (prompter, msg) {
  return prompter.prompt([
    {
      type: 'confirm',
      name: 'more',
      message: 'Add more properties? (yes) ',
      default: true
    }
  ])
  .then((result) => {
    if (result.more) {
      return setPropertyNoModel(prompter, msg)
        .then(() => setPropertiesNoModel(prompter, msg))
    }

    return msg
  })
}

function setPropertyNoModel (prompter, msg) {
  return prompter.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'property name: '
    },
    {
      type: 'input',
      name: 'value',
      message: 'property value: '
    }
  ])
  .then(result => {
    let name = result.name
    let value = result.value
    msg[name] = value
    return msg
  })
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
