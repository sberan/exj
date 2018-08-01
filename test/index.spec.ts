import { execFile } from 'child_process'
import { join } from 'path'
import { strictEqual as assertEqual, ok as assert, deepStrictEqual as assertDeepEqual, fail } from 'assert'
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from 'fs'

const { bin }: { bin: string } = require('../package.json')

const expectedHelpText = `
Usage: exj [OPTIONS] [-f | --file 'fnfile' ] ['fn']

        OPTIONS
         -j, --json
                Treat the input text as JSON. Input text will be parsed to
                JavaScript objects using JSON.parse() before being passed to fn.

         -l, --line
                Process each line of input separately. For each line of standard
                input, fn will be invoked for each line encountered, and the
                result will be written to standard output.

         -x, --exec
                Execute each output entry as a child process. The standard output
                of the finished process will be written to standard out.

                NOTE: Output entry MUST be an array of the format ['executable', 'arg1', 'arg2', ...]

         -f, --file 'fnfile'
                Read fn from a file, whose path is located at 'fnfile'.

         -g, --group-lines 'num'
                When processing lines, group batches of num lines together as an array

         -c, --concurrency 'num'
                When executing results via --exec option, execute at most num
                commands at once.

                Also applies to awaiting Promise results.

         -r, --require package[:alias]
                An NPM package to be required into the namespace of 'fn', with optional alias

         --help
                Print usage text
`.trim()

function exj (...args: string[]) {
  args.forEach(arg => {
    if (arg.startsWith('--')) {
      assert(expectedHelpText.includes(arg), `unknown flag: ${arg}`)
    } else if (arg.startsWith('-')) {
      arg.substring(1).split('').forEach(flag => {
        assert(expectedHelpText.match(`-[a-z]*${flag}[a-z]*`), `unknown flag: -${flag}`)
      })
    }
  })
  return (stdinStrings: TemplateStringsArray) => {
    const stdin = stdinStrings.join('').split('\n').map(line => line.trim()).filter(line => line.length).join('\n')
    return new Promise<string>((resolve, reject) => {
      const child = execFile(bin, args, (err, stdout, stderr) => {
        if (!err && stderr && stderr.trim()) {
          console.error(stderr.trim())
        }
        err ? reject(stderr ? new Error(stderr) : err) : resolve(stdout ? stdout.trim() : '')
      })
      child.stdin.write(stdin)
      child.stdin.end()
    })
  }
}

it('should run the given function', async () => {
  const result = await exj('() => 42')``
  assertEqual(result, '42')
})

it('should process input', async () => {
  const result = await exj('x => x + " world"')`hello,`
  assertEqual(result, 'hello, world')
})

it('should process input by line', async () => {
  const result = await exj('-l', 'x => x + x')`
    a
    b
    c
    d
    e
  `
  assertEqual(result, ['aa', 'bb', 'cc', 'dd', 'ee'].join('\n'))
})

it('should process JSON input', async () => {
  const result = await exj('--json', 'x => Object.keys(x).concat(Object.values(x))')`
    {
      "a": 1,
      "b": 2,
      "c": 3
    }
  `
  assertDeepEqual(JSON.parse(result), [ 'a', 'b', 'c', 1, 2, 3 ])
})

it('should process lines of JSON input', async () => {
  const result = await exj('-jl', '({a}) => a + 1')`
    { "a": 1 }
    { "a": 2 }
    { "a": 3 }
  `
  assertDeepEqual(result.split('\n'), [ '2', '3', '4' ])
})

it('should await promises returned from the fn', async () => {
  const result = await exj('--json', '--line', '({a}) => Promise.resolve(a)')`
    { "a": 1 }
    { "a": 2 }
    { "a": 3 }
  `
  assertDeepEqual(result.split('\n'), [ '1', '2', '3' ])
})

describe('result execution', () => {

  it('should execute the result of fn', async () => {
    const result = await exj('-lx', 'a => ["echo", a]')`
      1
      2
      3
    `
    assertDeepEqual(result.split('\n'), [ '1', '2', '3' ])
  })
  
  it('should execute the json result of fn', async () => {
    const result = await exj('-jlx', '({a}) => ["echo", a]')`
      { "a": "1" }
      { "a": "2" }
      { "a": "3" }
    `
    assertDeepEqual(result.split('\n'), [ '1', '2', '3' ])
  })

  it('should execute the result of grouped functions', async () => {
    const result = await exj('-lxg', '2', 'x => ["echo", x.join("")]')`
      1
      2
      3
      4
      5
      6
      7
    `
    assertDeepEqual(result.split('\n'), [ '12', '34', '56', '7' ])
  })

  it('should provide an error message if the result is not an array', async () => {
    try {
      await exj('-jlx', '({a}) => `echo nope`')`
        { "a": 1 }
        { "a": 2 }
        { "a": 3 }
      `
      fail('not thrown')
    } catch (err) {
      assert(err.message.trim(), `Error: result to execute was not an Array of strings: "echo nope"`)
    }
  })
})

it('should provide an error message if `fn` is not a function', async () => {
  try {
    await exj('')``
    fail('not thrown')
  } catch (err) {
    assertEqual(err.message.trim(), `Error: 'fn' argument "" did not evaluate to a JavaScript function\n${expectedHelpText}`)
  }
})

it('should provide help text', async () => {
  try {
    await exj('--help')``
    fail('not thrown')
  } catch (err) {
    assertEqual(err.message.trim(), expectedHelpText)
  }
})

describe('reading from a file', () => {
  let tempDir: string, tempFile: string
  beforeEach(() => {
    tempDir = mkdtempSync('exj'),
    tempFile = join(tempDir, 'foo.js')
  })
  afterEach(() => {
    unlinkSync(tempFile)
    rmdirSync(tempDir)
  })
  it('should read `fn` from a file', async () => {
    writeFileSync(tempFile, `x => x + 1`)

    const result = await exj('-jlf', tempFile)`
      1
      2
      3
    `
    assertDeepEqual(result.split('\n'), ["2", "3", "4"])
  })
})
describe('grouping', () => {
  it('should group lines into an array', async () => {
    const result = await exj('-lg', '3', 'x => x.map(y => +y + 1).join("")')`
      1
      2
      3
      4
      5
      6
      7
      8
      9
      10
      11
    `
    assertEqual(result, ['234', '567', '8910', '1112'].join('\n'))
  })

  it('should group lines of JSON into an array', async () => {
    const result = await exj('-lj', '--group-lines', '3', 'x => x[0].a')`
      { "a": 1 }
      { "a": 2 }
      { "a": 3 }
      { "a": 4 }
      { "a": 5 }
      { "a": 6 }
      { "a": 7 }
      { "a": 8 }
      { "a": 9 }
      { "a": 10 }
      { "a": 11 }
      { "a": 12 }
    `
    assertEqual(result, ['1', '4', '7', '10'].join('\n'))
  })

  it('should execute returned promises concurrently', async function() {
    this.timeout(300)
    this.retries(3)
    const result = await exj('-lc', '4', 'x => new Promise(resolve => setTimeout(() => resolve(x), +x))')`
      150
      130
      120
      100
    `
    assertEqual(result, ['150', '130', '120', '100'].join('\n'))
  })

  describe('requiring modules', () => {
    it('should allow modules to be required', async () => {
      const result = await exj('-lr', 'left-pad', 'x => leftPad(x, 3, "0")')`
        1
        2
        3
        4
      `

      assertEqual(result, ['001', '002', '003', '004'].join('\n'))
    })

    it('should allow required modules to be aliased', async () => {
      const result = await exj('-l', '--require', 'left-pad:padLeft', 'x => padLeft(x, 3, "0")')`
        1
        2
        3
        4
      `
      assertEqual(result, ['001', '002', '003', '004'].join('\n'))
    })
  })
})
