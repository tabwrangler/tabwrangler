/* eslint-env node */

const ArchivePlugin = require('webpack-archive-plugin');
const webpack = require('webpack');

const developmentConfig = require('./webpack.config.js');
const packageJson = require('./package.json');

module.exports = developmentConfig.map(function (platformConfig) {
  return Object.assign({}, platformConfig, {
    plugins: platformConfig.plugins.concat([
      // Set `NODE_ENV` to production to compile out React development-only code.
      new webpack.DefinePlugin({
        'process.env': {
          NODE_ENV: JSON.stringify('production'),
        },
      }),
      // Compress, minify, all those good things.
      new webpack.optimize.UglifyJsPlugin({
        minimize: true,
      }),
      new ArchivePlugin({
        format: 'zip',
        output: `tabwrangler-${platformConfig.name}-${packageJson.version}`,
      }),
    ]),
  });
});
