#!/usr/bin/env node

import opts from './options'
import asyncLines from 'async-lines'
import { execFile, ExecFileOptions } from 'child_process'
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs'
import PoolQueue from 'pool-queue'
import { join } from 'path'
import { homedir } from 'os'

function isStringArray(x: any): x is string[] {
  return Array.isArray(x) && x.length > 0 && x.every(item => typeof item === 'string')
}

let poolQueue: PoolQueue | undefined

function execFileAsync(cmd: string, args: string[], options: ExecFileOptions = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, options, (err, stdout, stderr) => {
      stderr && console.error(stderr)
      err ? reject(err) : resolve(stdout.trim())
    })
  })
}

function EXEC (strings: TemplateStringsArray, ...replacements: unknown[]) {
  const opts = strings.reduce((acc: string[], str, i) => {
    const next = [...acc, ...str.trim().split(/ +/)]
    if (i >= replacements.length) {
      return next
    }
    const replacement = replacements[i]
    return next.concat(typeof replacement === 'string' ? replacement : JSON.stringify(replacement))
  }, [])
  return execFileAsync(opts[0], opts.slice(1))
}

async function evalFn (fnText: string): Promise<Function> {
    const
      configDir = join(homedir(), '.exj'),
      packageJson = join(configDir, 'package.json'),
      resolveFrom = require('resolve-from'),
      packageNames = opts.requires.map(x => x.includes(':') ? x.substring(0, x.indexOf(':')) : x),
      packages = await Promise.all(packageNames.map(async packageName => {
        let pkg = resolveFrom.silent(process.cwd(), packageName)
        if (!pkg) {
          pkg = resolveFrom.silent(configDir, packageName)
        }
        if (!pkg) {
          if (!existsSync(configDir)) {
            mkdirSync(configDir)
          }
          if (!existsSync(packageJson)) {
            writeFileSync(packageJson, '{}')
          }
          await execFileAsync('npm', ['i', '--silent', packageName], { cwd: configDir })
          pkg = resolveFrom(configDir, packageName)
        }
        return require(pkg)
      })),
      pkgImports = opts.requires.map(x => {
        if (x.includes(':')) {
          return x.substring(x.indexOf(':') + 1)
        }
        return x.toLowerCase()
          .replace(/[^a-z]+([a-z])/g, (_,f) => f.toUpperCase())
          .replace(/^[A-Z]/, x => x.toLowerCase())
      })
    const fn = new Function(...pkgImports, 'EXEC', `
      return ${fnText}
    `)(...packages, EXEC)
    if (typeof fn === 'function') {
      return fn
    } else {
      throw `'fn' argument "${fnText}" did not evaluate to a JavaScript function`
    }
}

async function processText (text: string | string[], fn: Function) {
  let result = fn(text)
  if (result && result.then && result.catch) {
    poolQueue = poolQueue || new PoolQueue(opts.concurrency)
    result = await poolQueue.submit(() => result)
  } else if (opts.execResult) {
    poolQueue = poolQueue || new PoolQueue(opts.concurrency)
    result = await poolQueue.submit(async () => {
      if (!isStringArray(result)) {
        throw new Error(`result to execute was not an Array of strings: ${JSON.stringify(result)}`)
      }
      return execFileAsync(result[0], result.slice(1))
    })
  }
  if (result === null || result === undefined) {
    return
  } if (typeof result !== 'string'){
    console.log(JSON.stringify(result))
  } else {
    console.log(result)
  }
}

function processJson (text: string | string[], fn: Function) {
  if (Array.isArray(text)) {
    text = '[' + text.join(',') + ']'
  }
  return processText(JSON.parse(text), fn)
}

function printErrorAndExit (err: any) {
  console.error(err.toString())
  process.exit(1);
}

async function main(app: () => Promise<any>) {
  try {
    await app();
    process.exit(0);
  }
  catch (err) {
    printErrorAndExit(err)
  }
}

main(async () => {
  if (opts.showHelp) {
    const readme = readFileSync(require.resolve('../README.md')).toString().replace(/<\/?(em|b|pre)>/g, '')
    throw `Usage: ${readme.match(/SYNOPSIS\n\s*(.*)/)![1]}\n
       ${readme.substring(readme.indexOf(' OPTIONS'), readme.indexOf('EXAMPLES'))}`
  }
  const
    fnText = opts.fnFile ? readFileSync(opts.fnFile).toString() : opts.fnText || '',
    fn = await evalFn(fnText),
    processInput = (text: string| string[]) => (opts.json ? processJson: processText)(text, fn).catch(printErrorAndExit),
    allLines: string[] = [],
    groupedLines: string[] = [],
    flushGroupedLines = () => {
      processInput(groupedLines.slice())
      groupedLines.length = 0
    }

  for await (const line of asyncLines(process.stdin)) {
    poolQueue && await poolQueue.poll()
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
  poolQueue && await poolQueue.drain()
})
