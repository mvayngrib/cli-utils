'use strict'

const Q = require('q')
const constants = require('@tradle/constants')
const Builder = require('@tradle/chained-obj').Builder
const genUser = require('./genUser')
const ROOT_HASH = constants.ROOT_HASH
const TYPE = constants.TYPE

module.exports = {
  genUser,
  toJSONForConsole,
  promptBuildMsg,
  signNSend,
  previewSend
}

function toJSONForConsole (obj) {
  return JSON.stringify(obj, replacer, 2)
}

function promptBuildMsg (prompter, models) {
  return prompter.prompt([
    {
      type: 'input',
      name: 'type',
      message: 'type (tradle.SimpleMessage) ',
      default: 'tradle.SimpleMessage'
    }
  ])
  .then((result) => {
    let msg = {
      [TYPE]: result.type
    }

    const model = models[msg[TYPE]]
    return model ? setPropertiesWithModel(prompter, model, msg) : setPropertiesNoModel(prompter, msg)
  })
}

function toCoords (recipient) {
  return [{ [ROOT_HASH]: recipient[ROOT_HASH] }]
}

function signNSend (prompter, tim, opts) {
  let msg = opts.msg
  return tim.sign(msg)
    .then(msg => previewSend(prompter, msg))
    .then(buildMsg)
    .then((buf) => {
      opts.msg = buf
      return tim.send(opts)
    })
    .then((entries) => {
      prompter.log('message queued')
      let rh = entries[0].get(ROOT_HASH)
      let sentHandler = (info) => {
        if (info[ROOT_HASH] === rh) {
          prompter.log(`delivered ${info[TYPE] || 'untyped message'} with hash ${rh}`)
          tim.removeListener('sent', sentHandler)
        }
      }

      tim.on('sent', sentHandler)
    })
}

function previewSend (prompter, msg) {
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

function buildMsg (msg) {
  return Builder()
    .data(msg)
    .build()
}
