const fs = require('fs')
const path = require('path')
const test = require('node:test')
const assert = require('node:assert/strict')
const zlib = require('zlib')

const config = require('./webpack.modern')

function getBabelOptions() {
  const jsRule = config.module.rules.find(
    (rule) => String(rule.test) === String(/\.js$/)
  )
  const babelLoader = jsRule.use.find((loader) => loader.loader === 'babel-loader')

  return babelLoader.options
}

test('modern webpack config targets latest iOS Safari', () => {
  const babelOptions = getBabelOptions()
  const presetEnv = babelOptions.presets.find(
    (preset) => Array.isArray(preset) && preset[0] === '@babel/preset-env'
  )

  assert.equal(config.mode, 'production')
  assert.equal(config.output.filename, 'eruda.modern.js')
  assert.deepEqual(config.target, ['web', 'es2022'])
  assert.equal(presetEnv[1].targets, 'last 1 iOS version')
  assert.equal(presetEnv[1].bugfixes, true)
  assert.equal(presetEnv[1].modules, false)
  assert.deepEqual(babelOptions.plugins, [])
})

test('modern output keeps legacy helpers out of the artifact', () => {
  const modernOutput = path.resolve(__dirname, '../dist/eruda.modern.js')
  const legacyOutput = path.resolve(__dirname, '../dist/eruda.js')

  assert.equal(fs.existsSync(modernOutput), true)
  assert.equal(fs.existsSync(legacyOutput), true)

  const modernCode = fs.readFileSync(modernOutput, 'utf8')
  const legacyCode = fs.readFileSync(legacyOutput, 'utf8')

  assert.equal(modernCode.includes('regeneratorRuntime'), false)
  assert.equal(modernCode.includes('_asyncToGenerator'), false)
  assert.equal(modernCode.includes('_classCallCheck'), false)
  assert.equal(modernCode.length < legacyCode.length, true)
  assert.equal(
    zlib.gzipSync(modernCode).length < zlib.gzipSync(legacyCode).length,
    true
  )
})
