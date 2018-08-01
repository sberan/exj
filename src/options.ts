import { readFileSync } from 'fs'
import getOpts from "getopts"
import { resolve as resolvePath } from 'path'

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

function fnArg (text: string | undefined, file: string | undefined, requires: string[]): Function | undefined {
  const fnText = file ? readFileSync(file).toString() : text
  try {
    const
      packages = requires.map(x => x.includes(':') ? x.substring(0, x.indexOf(':')) : x).map(moduleName => {
        const modulePath = require('resolve-from')(resolvePath('.'), moduleName)
        return require(modulePath)
      }),
      pkgImports = requires.map(x => {
        if (x.includes(':')) {
          return x.substring(x.indexOf(':') + 1)
        }
        return x.toLowerCase()
            .replace(/[^a-z]+([a-z])/g, (_,f) => f.toUpperCase())
            .replace(/^[A-Z]/, x => x.toLowerCase())
      })
    const fn = new Function(...pkgImports, `
      return ${fnText}
    `)(...packages)
    if (typeof fn === 'function') {
      return fn
    }
  } catch (err) {
    console.error(err.message)
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