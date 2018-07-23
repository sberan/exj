const { execFile } = require('child_process')
const { join } = require('path')
const assert = require('assert')
const { bin } = require('../package.json')
const { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } = require('fs')

const expectedHelpText = `Usage: exj [--json] [--line] [--exec] [-jlx] [-f | --file 'fnfile' ] ['fn']`

function xj (...args) {
  return (...stdinStrings) => {
    const stdin = stdinStrings.join('').split('\n').map(line => line.trim()).filter(line => line.length).join('\n')
    return new Promise((resolve, reject) => {
      const child = execFile(bin, args, (err, stdout, stderr) => {
        if (!err && stderr && stderr.trim()) {
          console.error(stderr.trim())
        }
        err ? reject(new Error(stderr)) : resolve(stdout.trim())
      })
      child.stdin.write(stdin)
      child.stdin.end()
    })
  }
}

it('should run the given function', async () => {
  const result = await xj('() => 42')``
  assert.equal(result, 42)
})

it('should process input', async () => {
  const result = await xj('x => x + " world"')`hello,`
  assert.equal(result, 'hello, world')
})

it('should process input by line', async () => {
  const result = await xj('-l', 'x => x + x')`
    a
    b
    c
    d
    e
  `
  assert.equal(result, ['aa', 'bb', 'cc', 'dd', 'ee'].join('\n'))
})

it('should process JSON input', async () => {
  const result = await xj('--json', 'x => Object.keys(x).concat(Object.values(x))')`
    {
      "a": 1,
      "b": 2,
      "c": 3
    }
  `
  assert.deepEqual(JSON.parse(result), [ 'a', 'b', 'c', 1, 2, 3 ])
})

it('should process lines of JSON input', async () => {
  const result = await xj('-jl', '({a}) => a + 1')`
    { "a": 1 }
    { "a": 2 }
    { "a": 3 }
  `
  assert.deepEqual(result.split('\n'), [ 2, 3, 4 ])
})

it('should await promises returned from the fn', async () => {
  const result = await xj('--json', '--line', '({a}) => Promise.resolve(a)')`
    { "a": 1 }
    { "a": 2 }
    { "a": 3 }
  `
  assert.deepEqual(result.split('\n'), [ 1, 2, 3 ])
})

it('should execute the result of fn', async () => {
  const result = await xj('-jlx', '({a}) => `echo ${a}`')`
    { "a": 1 }
    { "a": 2 }
    { "a": 3 }
  `
  assert.deepEqual(result.split('\n'), [ 1, 2, 3 ])
})

it('should provide an error message if `fn` is not a function', async () => {
  try {
    const result = await xj()``
    assert.fail()
  } catch (err) {
    assert.equal(err.message, `Error: 'fn' argument "/Users/samuel.beran/Code/exj/index.js" did not evaluate to a JavaScript function\n${expectedHelpText}`)
  }
})

it('should provide help text', async () => {
  try {
    const result = await xj('--help')``
    assert.fail()
  } catch (err) {
    assert.equal(err.message.trim(), expectedHelpText)
  }
})

describe('reading from a file', () => {
  let tempDir, tempFile
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

    const result = await xj('-fjl', tempFile)`
      1
      2
      3
    `
    assert.deepEqual(result.split('\n'), ["2", "3", "4"])
  })
})
describe('grouping', () => {
  it('should group lines into an array', async () => {
    const result = await xj('-lg', '3', 'x => x.map(y => +y + 1).join("")')`
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
    assert.equal(result, ['234', '567', '8910', '1112'].join('\n'))
  })

  it('should group lines of JSON into an array', async () => {
    const result = await xj('-lj', '--group-lines', '3', 'x => x[0].a')`
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
    assert.equal(result, ['1', '4', '7', '10'].join('\n'))
  })
})
