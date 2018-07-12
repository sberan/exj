const { execFile } = require('child_process')
const { resolve } = require('path')
const assert = require('assert')
const { bin } = require('../package.json')


function xj (...args) {
  return (...stdinStrings) => {
    const stdin = stdinStrings.join('').split('\n').map(line => line.trim()).filter(line => line.length).join('\n')
    return new Promise((resolve, reject) => {
      const child = execFile(bin, args, (err, stdout, stderr) => {
        stderr && console.log(stderr)
        err ? reject(err) : resolve(stdout.trim())
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

it('should execute the result of fn ', async () => {
  const result = await xj('-jl', '--exec', '({a}) => `echo ${a}`')`
    { "a": 1 }
    { "a": 2 }
    { "a": 3 }
  `
  assert.deepEqual(result.split('\n'), [ 1, 2, 3 ])
})
