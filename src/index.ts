#!/usr/bin/env node

import readline from 'readline'
import { execFile } from 'child_process'
import { readFileSync } from 'fs'
import opts from './options'

function isStringArray(x: any): x is string[] {
  return Array.isArray(x) && x.length > 0 && !x.every(item => typeof item === 'string')
}

const
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
    let result = opts.fn!(text)
    if (result && result.then && result.catch){
      enqueueResult(result)
    } else if (opts.execResult) {
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
  processInput = opts.json ? processJson : processText

if (opts.showHelp) {
  process.stderr.write('Usage: ' + readFileSync(require.resolve('./README.md')).toString().replace(/<\/?(em|b|pre)>/g, '').match(/SYNOPSIS\n\s*(.*)/)![1])
  process.exit(1)
}
let fullInput = '',
  groupedLines: string[] = []

function flushGroupedLines () {
  opts.json ? processJson('[' + groupedLines.join(',') + ']') : processText(groupedLines)
  groupedLines = []
}

lineReader.on('line', line => {
  if (opts.eachLine) {
    if (opts.groupLines) {
      groupedLines.push(line)
      if (groupedLines.length === opts.groupLines) {
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
  if (opts.eachLine) {
    if (opts.groupLines && groupedLines.length) {
      flushGroupedLines()
    }
    return
  }
  processInput(fullInput)
})

process.stdin.on('end', () => {
  lineReader.close()
})
