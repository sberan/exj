#!/usr/bin/env node

const
  readline = require('readline'),
  { exec } = require('child_process')
  hasFlag = (...flags) => process.argv.some(arg => {
    const shortArgs = arg.match(/^-([a-z]+)$/)
    if (shortArgs) {
      return flags.some(flag => {
        const shortFlag = flag.match(/^-([a-z]+)$/)
        return Boolean(shortFlag && shortArgs[1].indexOf(shortFlag[1]) >= 0)
      })
    }
    return flags.some(expect => arg === expect)
  }),
  json = hasFlag('-j', '--json'),
  eachLine = hasFlag('-l', '--line'),
  execResult = hasFlag('-x', '--exec'),
  fn = new Function('return ' + process.argv[process.argv.length - 1])(),
  currentExec = Promise.resolve()
  processText = async text => {
    let result = fn(text)
    if (result && result.then){
      result = await result
    }
    if (execResult) {
      currentExec = currentExec.then(() => new Promise((resolve, reject) => {
        exec(result, (err, stdout, stderr) => {
          stderr && console.error(stderr)
          err ? reject(new Error('process failed: ' + result)) : resolve(stdout.trim())
        })
      })).catch(err => {
        console.error(err)
      })
      result = await currentExec
    }
    if (typeof result !== 'string'){
      result = JSON.stringify(result)
    }
    console.log(result)
  },
  processJson = text => processText(JSON.parse(text)),
  processInput = json ? processJson :  processText,
  lineReader = readline.createInterface({
    input: process.stdin
  })

let fullInput = ''

lineReader.on('line', line => {
  if (eachLine) {
    processInput(line)
  } else {
    fullInput += line
  }
})

lineReader.once('close', () => {
  if (eachLine) {
    return
  }
  processInput(fullInput)
})

process.stdin.on('end', () => {
  lineReader.close()
})
