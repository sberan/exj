import { execFile } from 'child_process'
import { join, resolve as resolvePath } from 'path'
import { strictEqual as assertEqual, ok as assert, deepStrictEqual as assertDeepEqual, fail } from 'assert'
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync, write } from 'fs'

const { bin }: { bin: string } = require('../package.json')

const expectedHelpText = `
Usage: exj [OPTIONS] 'fn'

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

                Concurrency level also applies to awaiting of Promise results: no more lines
                of input will be processed while 'num' results are in flight.

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
      const child = execFile(bin, args, { cwd: resolvePath('.') }, (err, stdout, stderr) => {
        if (!err && stderr && stderr.trim()) {
          console.error(stderr.trim())
        }
        err ? reject(stderr ? new Error(stderr.trim()) : err) : resolve(stdout ? stdout.trim() : '')
      })
      child.stdin.write(stdin)
      child.stdin.end()
    })
  }
}

function exjError (...args: string[]) {
  return async (stdinStrings: TemplateStringsArray): Promise<string> => {
    try {
      await exj(...args)(stdinStrings)
      return fail('did not throw!')
    } catch (err) {
      return err.message
    }
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

it('should omit null or undefined results', async () => {
  const result = await exj('-lj', 'x => x === 3 ? undefined : x')`
    null
    2
    3
    4
    null
    6
  `
  assertEqual(result, ['2', '4', '6'].join('\n'))
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

describe('returning promises', () => {
  it('should await promises returned from the fn', async () => {
    const result = await exj('--json', '--line', '({a}) => Promise.resolve(a)')`
      { "a": 1 }
      { "a": 2 }
      { "a": 3 }
    `
    assertDeepEqual(result.split('\n'), [ '1', '2', '3' ])
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
    const message = await exjError('-jlx', '({a}) => `echo nope`')`
        { "a": 1 }
        { "a": 2 }
        { "a": 3 }
      `
    assertEqual(message, `Error: result to execute was not an Array of strings: "echo nope"`)
  })
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

  it('should not clear input array with asynchronous grouping', async () => {
    const result = await exj('-lg', '3', 'x => Promise.resolve().then(() => x.join(""))')`
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
      12
    `
    assertEqual(result, ['123', '456', '789', '101112'].join('\n'))
  })
})

describe('requiring modules', () => {
  it('should allow modules to be required', async () => {
    const result = await exj('-lr', 'left-pad', 'x => leftPad(x, 3, "0")')`
      1
      2
      3
      4
    `
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

  describe('with a json file in the current directory', () => {
    const testJsonPath = join(process.cwd(), 'test.json')
    before(() => writeFileSync(testJsonPath, '"it works"'))
    after(() => unlinkSync(testJsonPath))

    it('should be able to require the file from current directory', async () => {
      const result = await exj('-l', '--require', './test.json', 'x => testJson')`
        1
      `
      assertEqual(result, "it works")
    })

    it('should require relative modules', async () => {
      const result = await exj('--require', './test.json', '() => testJson')``
      assertEqual(result, "it works")
    })
  })

  it('should allow missing modules to be installed', async function() {
    this.timeout(10000)
    const result = await exj('-l', '--require', 'right-pad', 'x => rightPad(x, 3, "0")')`
      1
      2
      3
      4
    `
    assertEqual(result, ['100', '200', '300', '400'].join('\n'))
  })
})

describe('error handilng', () => {
  it('should provide help text', async () => {
    const message = await exjError('--help')``
    assertEqual(message, expectedHelpText)
  })

  it('should provide an error if fn is not a function', async () => {
    const message = await exjError()`1`
    assertEqual(message, `'fn' argument "" did not evaluate to a JavaScript function`)
  })

  it('should throw for a syntax error in fn', async () => {
    const message = await exjError(' => " ')``
    assertEqual(message, 'SyntaxError: Unexpected token =>')
  })

  it('should throw for an undefined global in fn', async () => {
    const message = await exjError('-lc', '4', 'x => asdf')`
      1
    `
    assertEqual(message, 'ReferenceError: asdf is not defined')
  })

  it('should handle an error during fn evaluation', async () => {
    const message = await exjError('-lj', 'x => x.boom()')`
      null
    `
    assertEqual(message, `TypeError: Cannot read property 'boom' of null`)
  })
})
