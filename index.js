#!/usr/bin/env node

const readline = require('readline')
const { exec } = require('child_process')
const { readFileSync } = require('fs')

function readFn ({ file, text }) {
  const fnArg = file ? readFileSync(file).toString() : text
  let fn
  try {
    fn = new Function('return ' + fnArg)()
  } catch (_) {
  } finally {
    if (typeof fn !== 'function' && fnArg !== '--help') {
      console.error(`Error: 'fn' argument "${fnArg}" did not evaluate to a JavaScript function`)
      return
    }
    return fn
  }
}

const
  hasFlag = (...flags) => process.argv.find((arg, i) => {
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
  fnFileArg = hasFlag('-f', '--file'),
  fn = readFn(fnFileArg ? { file: process.argv[process.argv.indexOf(fnFileArg) + 1]} : { text: process.argv[process.argv.length - 1] })
  showHelp = hasFlag('--help') || !fn,
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

if (showHelp) {
  process.stderr.write('Usage: ' + readFileSync(require.resolve('./README.md')).toString().replace(/<\/?(em|b|pre)>/g, '').match(/SYNOPSIS\n\s*(.*)/)[1])
  process.exit(1)
}
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
