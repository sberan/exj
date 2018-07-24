#!/usr/bin/env node

import opts from './options'
import asyncLines from 'async-lines'
import { execFile } from 'child_process';
import { readFileSync } from 'fs';
import main from 'async-main'
import PoolQueue from 'pool-queue'

function isStringArray(x: any): x is string[] {
  return Array.isArray(x) && x.length > 0 && !x.every(item => typeof item === 'string')
}
const poolQueue = new PoolQueue(opts.concurrency)

async function processText (text: string | string[]) {
  let result = opts.fn!(text)
  if (result && result.then && result.catch){
    result = await poolQueue.submit(() => result).catch(err => {
      console.error(err)
      process.exit(1)
    })
  } else if (opts.execResult) {
    result = await poolQueue.submit(() => new Promise((resolve, reject) => {
      if (!isStringArray(result)) {
        return reject(new Error(`result to execute was not an Array of strings: ${JSON.stringify(result)}`))
      }
      execFile(result[0], result.slice(1), (err, stdout, stderr) => {
        stderr && console.error(stderr)
        err ? reject(err) : resolve(stdout.trim())
      })
    })).catch(err => {
      console.error(err)
      process.exit(1)
    })
  }
  if (typeof result !== 'string'){
    console.log(JSON.stringify(result))
  } else {
    console.log(result)
  }
}

function processJson (text: string | string[]) {
  if (Array.isArray(text)) {
    text = '[' + text.join(',') + ']'
  }
  return processText(JSON.parse(text))
}

main(async () => {
  if (!opts.fn) {
    if (!opts.showHelp) {
      console.error(`Error: 'fn' argument "${opts.fnArg}" did not evaluate to a JavaScript function`)
    }
    process.stderr.write('Usage: ' + readFileSync(require.resolve('../README.md')).toString().replace(/<\/?(em|b|pre)>/g, '').match(/SYNOPSIS\n\s*(.*)/)![1])
    process.exit(1)
  }

  const
    processInput = opts.json ? processJson : processText,
    allLines: string[] = [],
    groupedLines: string[] = [],
    flushGroupedLines = async () => {
      processInput(groupedLines)
      groupedLines.length = 0
    }

  for await (const line of asyncLines(process.stdin)) {
    await poolQueue.poll()
    if (opts.groupLines) {
      groupedLines.push(line)
      if (groupedLines.length === opts.groupLines) {
        flushGroupedLines()
      }
    } else if (opts.eachLine) {
      processInput(line)
    } else {
      allLines.push(line)
    }
  }
  if (groupedLines.length) {
    flushGroupedLines()
  }
  if (!opts.eachLine && !opts.groupLines) {
    processInput(allLines.join('\n'))
  }
  await poolQueue.drain()
})
