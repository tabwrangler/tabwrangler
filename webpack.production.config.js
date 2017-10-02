/* eslint-env node */

const webpack = require('webpack');

const developmentConfig = require('./webpack.config.js');

module.exports = Object.assign({}, developmentConfig, {
  plugins: developmentConfig.plugins.concat([
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
  ]),
});
