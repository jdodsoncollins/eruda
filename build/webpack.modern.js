const webpack = require('webpack')
const TerserPlugin = require('terser-webpack-plugin')

const config = require('./webpack.base')

const modernTargets = 'last 1 iOS version'

config.mode = 'production'
config.target = ['web', 'es2022']
config.output.filename = 'eruda.modern.js'
config.output.environment = {
  arrowFunction: true,
  asyncFunction: true,
  const: true,
  destructuring: true,
  dynamicImport: true,
  forOf: true,
  optionalChaining: true,
  templateLiteral: true,
}
config.devtool = 'source-map'
config.plugins = config.plugins.concat([
  new webpack.DefinePlugin({
    ENV: '"production"',
  }),
])
config.optimization = {
  minimize: true,
  minimizer: [
    new TerserPlugin({
      extractComments: false,
      terserOptions: {
        ecma: 2022,
        compress: {
          ecma: 2022,
        },
        format: {
          ecma: 2022,
        },
      },
    }),
  ],
}

const jsRule = config.module.rules.find((rule) => String(rule.test) === String(/\.js$/))
const babelLoader = jsRule.use.find((loader) => loader.loader === 'babel-loader')

babelLoader.options = {
  sourceType: 'unambiguous',
  presets: [
    [
      '@babel/preset-env',
      {
        bugfixes: true,
        modules: false,
        targets: modernTargets,
      },
    ],
  ],
  plugins: [],
}

module.exports = config
