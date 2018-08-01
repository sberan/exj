import { readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import getOpts from 'getopts'
import { resolve } from 'dns';

function boolArg (arg?: string) {
  return Boolean(arg)
}
  
function numArg <T extends number | undefined>(arg: string | undefined, defaultValue: T) {
  return (arg && !isNaN(+arg)) ? +arg : defaultValue
}

function arrayArg (arg: string | string[] | undefined) {
  if (!arg) {
    return []
  }
  if (Array.isArray(arg)) {
    return arg
  }

  return [arg]
}

async function fnArg (text: string | undefined, file: string | undefined, requires: string[]): Promise<Function | undefined> {
  const fnText = file ? readFileSync(file).toString() : text
  try {
    const
      packageNames = requires.map(x => x.includes(':') ? x.substring(0, x.indexOf(':')) : x),
      packages = await Promise.all(packageNames.map(async packageName => {
        try {
          return require(packageName)
        } catch (err) {
          const
            npm = require('global-npm'),
            moduleCache = join(homedir(), '.exj_modules')
          console.log('hi')
          await new Promise((resolve, reject) => {
            npm.load({loglevel: 'silent'}, (err: any) => err ? reject(err) : resolve())
          })
          console.log('yo')
          console.error('INSTALL', npm.commands.i)
        }
      })),
      pkgImports = requires.map(x => {
        if (x.includes(':')) {
          return x.substring(x.indexOf(':') + 1)
        }
        return x.toLowerCase().replace(/[^a-z]+([a-z])/g, (_,f) => f.toUpperCase())
      })
    console.log({packages})
    const fn = new Function(...pkgImports, `
      return ${fnText}
    `)(...packages)
    if (typeof fn === 'function') {
      return fn
    }
  } catch (err) {
    console.log(err)
  }
}

const opts: { [key: string]: string } = getOpts(process.argv.slice(2), {
  boolean: ['json', 'line', 'exec', 'help'],
  alias: {
    'json' : 'j',
    'line' : 'l',
    'exec' : 'x',
    'file' : 'f',
    'group-lines' : 'g',
    'concurrency' : 'c',
    'require' : 'r'
  }
})


const
  fnText = opts._,
  fn = fnArg(opts._, opts.file, arrayArg(opts.require)),
  json = boolArg(opts.json),
  eachLine = boolArg(opts.line),
  execResult = boolArg(opts.exec),
  groupLines = numArg(opts['group-lines'], undefined),
  showHelp = boolArg(opts.help),
  concurrency = numArg(opts.concurrency, 1)

export default {
  concurrency,
  eachLine,
  execResult,
  fn,
  fnArg: fnText,
  groupLines,
  json,
  showHelp
}