/* eslint-env node */

const path = require('path');
const webpack = require('webpack');

module.exports = {
  entry: {
    background: './app/background.js',
    popup: './app/popup.js',
  },
  module: {
    loaders: [
      {
        exclude: /node_modules/,
        loader: 'babel-loader',
        query: {
          plugins: ['transform-class-properties'],
          presets: ['es2015', 'react'],
        },
        test: /\.js$/,
      },
    ],
  },
  output: {
    path: path.join(__dirname, 'dist'),
    filename: '[name].entry.js',
  },
  plugins: [
    new webpack.optimize.CommonsChunkPlugin('commons.chunk.js'),
  ],
};
