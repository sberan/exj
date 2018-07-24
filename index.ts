#!/usr/bin/env node

import readline from 'readline'
import { execFile } from 'child_process'
import { readFileSync } from 'fs'

function readFn ({ file, text }: { file?: string, text?: string }) {
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

function isStringArray(x: any): x is string[] {
  return Array.isArray(x) && x.length > 0 && !x.every(item => typeof item === 'string')
}

const
  hasFlag = (...flags: string[]) => process.argv.find((arg, i) => {
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
  groupLines = groupLinesFlag ? +process.argv[process.argv.indexOf(groupLinesFlag) + 1] : false,
  showHelp = hasFlag('--help') || !fn,
  lineReader = readline.createInterface({
    input: process.stdin
  }),
  sendResult = (result: string | object) => typeof result !== 'string' ? console.log(JSON.stringify(result)) : console.log(result),
  resultQueue = Promise.resolve(),
  enqueueResult = (op: Promise<string | object>) => {
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
  processText = (text: string | string[]) => {
    let result = fn(text)
    if (result && result.then && result.catch){
      enqueueResult(result)
    } else if (execResult) {
      enqueueResult(new Promise((resolve, reject) => {
        if (!isStringArray(result)) {
          return reject(new Error(`result to execute was not an Array of strings: ${JSON.stringify(result)}`))
        }
        execFile(result[0], result.slice(1), (err, stdout, stderr) => {
          stderr && console.error(stderr)
          err ? reject(err) : resolve(stdout.trim())
        })
      }))
    } else {
      sendResult(result)
    }
  },
  processJson = (text:string) => processText(JSON.parse(text)),
  processInput = json ? processJson : processText

if (showHelp) {
  process.stderr.write('Usage: ' + readFileSync(require.resolve('./README.md')).toString().replace(/<\/?(em|b|pre)>/g, '').match(/SYNOPSIS\n\s*(.*)/)![1])
  process.exit(1)
}
let fullInput = '',
  groupedLines: string[] = []

function flushGroupedLines () {
  json ? processJson('[' + groupedLines.join(',') + ']') : processText(groupedLines)
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
