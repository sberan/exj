import { readFileSync } from 'fs'
import getOpts from "getopts";

function readFn ({ file, text }: { file?: string, text?: string }): Function | undefined {
  const fnArg = file ? readFileSync(file).toString() : text
  try {
    const fn = new Function('return ' + fnArg)()
    if (typeof fn === 'function') {
      return fn
    }
  } catch (_) {
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
    'concurrency' : 'c'
  }
})
const
  json = Boolean(opts.json),
  eachLine = Boolean(opts.line),
  execResult = Boolean(opts.exec),
  fnArg = opts._,
  fn = readFn(opts.file ? { file: opts.file } : { text: fnArg }),
  groupLines = opts['group-lines'] && +opts['group-lines'],
  showHelp = Boolean(opts.help),
  concurrency = isNaN(+opts.concurrency) ? 1 : +opts.concurrency

export default {
  concurrency,
  eachLine,
  execResult,
  fn,
  fnArg,
  groupLines,
  json,
  showHelp
}