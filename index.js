#!/usr/bin/env node

const readline = require('readline')
const { execFile } = require('child_process')
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
  fn = readFn(fnFileArg ? { file: process.argv[process.argv.indexOf(fnFileArg) + 1]} : { text: process.argv[process.argv.length - 1] }),
  groupLinesFlag = hasFlag('-g', '--group-lines'),
  groupLines = groupLinesFlag ? +process.argv[process.argv.indexOf(groupLinesFlag) + 1] : false
  showHelp = hasFlag('--help') || !fn,
  lineReader = readline.createInterface({
    input: process.stdin
  }),
  sendResult = result => typeof result !== 'string' ? console.log(JSON.stringify(result)) : console.log(result),
  resultQueue = Promise.resolve(),
  enqueueResult = (op) => {
    resultQueue.then(() => {
      lineReader.pause()
      return op
    }).then(result => { 
      sendResult(result)
      lineReader.resume()
    }).catch(err => {
      console.error('Error:', err.message)
      process.exit(1)
    })
  },
  processText = text => {
    let result = fn(text)
    if (result && result.then && result.catch){
      enqueueResult(result)
    } else if (execResult) {
      enqueueResult(new Promise((resolve, reject) => {
        if (!Array.isArray(result) || !result.length) {
          throw new Error(`result to execute was not an Array: ${JSON.stringify(result)}`)
        }
        execFile(result.shift(), result, (err, stdout, stderr) => {
          stderr && console.error(stderr)
          err ? reject(new Error('process failed: ' + result)) : resolve(stdout.trim())
        })
      }))
    } else {
      sendResult(result)
    }
  },
  processJson = text => processText(JSON.parse(text)),
  processInput = json ? processJson : processText

if (showHelp) {
  process.stderr.write('Usage: ' + readFileSync(require.resolve('./README.md')).toString().replace(/<\/?(em|b|pre)>/g, '').match(/SYNOPSIS\n\s*(.*)/)[1])
  process.exit(1)
}
let fullInput = '',
  groupedLines = []

function flushGroupedLines () {
  processInput(json ? '[' + groupedLines.join(',') + ']' : groupedLines)
  groupedLines = []
}

lineReader.on('line', line => {
  if (eachLine) {
    if (groupLines) {
      groupedLines.push(line)
      if (groupedLines.length === groupLines) {
        flushGroupedLines()
      }
    } else {
      processInput(line)
    }
  } else {
    fullInput += line
  }
})

lineReader.once('close', () => {
  if (eachLine) {
    if (groupLines && groupedLines.length) {
      flushGroupedLines()
    }
    return
  }
  processInput(fullInput)
})

process.stdin.on('end', () => {
  lineReader.close()
})
