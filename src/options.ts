import getOpts from 'getopts'

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

const opts: { [key: string]: string } = getOpts(process.argv.slice(2), {
  boolean: ['json', 'line', 'exec', 'help'],
  alias: {
    'pretty': 'p',
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
  fnText = opts._ || undefined,
  fnFile = opts.file || undefined,
  requires = arrayArg(opts.require),
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
  fnText,
  fnFile,
  requires,
  groupLines,
  json,
  showHelp
}