/* eslint-env node */

const ArchivePlugin = require('webpack-archive-plugin');
const OptimizeCssAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const developmentConfig = require('./webpack.config.js');
const packageJson = require('./package.json');

module.exports = developmentConfig.map(function(platformConfig) {
  return Object.assign({}, platformConfig, {
    devtool: false,
    mode: 'production',
    plugins: platformConfig.plugins.concat([
      new OptimizeCssAssetsPlugin(),
      new ArchivePlugin({
        format: 'zip',
        output: `tabwrangler-${platformConfig.name}-${packageJson.version}`,
      }),
    ]),
  });
});
