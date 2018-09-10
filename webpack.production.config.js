/* eslint-env node */

const ArchivePlugin = require('webpack-archive-plugin');
const developmentConfig = require('./webpack.config.js');
const packageJson = require('./package.json');
const webpack = require('webpack');

module.exports = developmentConfig.map(function(platformConfig) {
  return Object.assign({}, platformConfig, {
    devtool: false,
    mode: 'production',
    plugins: platformConfig.plugins.concat([
      // Set `NODE_ENV` to production to compile out React development-only code.
      new webpack.DefinePlugin({
        'process.env': {
          NODE_ENV: JSON.stringify('production'),
        },
      }),
      new ArchivePlugin({
        format: 'zip',
        output: `tabwrangler-${platformConfig.name}-${packageJson.version}`,
      }),
    ]),
  });
});
