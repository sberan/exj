import { readFileSync } from 'fs'

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

function hasFlag (...flags: string[]) {
  return process.argv.find(arg => {
    const shortArgs = arg.match(/^-([a-z]+)$/)
    if (shortArgs) {
      return flags.some(flag => {
        const shortFlag = flag.match(/^-([a-z]+)$/)
        return Boolean(shortFlag && shortArgs[1].indexOf(shortFlag[1]) >= 0)
      })
    }
    return flags.some(expect => arg === expect)
  })
}

const
  json = hasFlag('-j', '--json'),
  eachLine = hasFlag('-l', '--line'),
  execResult = hasFlag('-x', '--exec'),
  fnFileArg = hasFlag('-f', '--file'),
  fnArg = process.argv[process.argv.length - 1],
  fn = readFn(fnFileArg ? { file: process.argv[process.argv.indexOf(fnFileArg) + 1]} : { text: fnArg }),
  groupLinesFlag = hasFlag('-g', '--group-lines'),
  groupLines = groupLinesFlag ? +process.argv[process.argv.indexOf(groupLinesFlag) + 1] : undefined,
  showHelp = hasFlag('--help')

export default {
  eachLine,
  execResult,
  fn,
  fnArg,
  groupLines,
  json,
  showHelp
}