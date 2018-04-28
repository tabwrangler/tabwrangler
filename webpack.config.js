/* eslint-env node */

const CopyWebpackPlugin = require('copy-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');
const webpack = require('webpack');

const COMMON_CONFIG = {
  entry: {
    background: './app/background.js',
    popup: './app/popup.js',
  },
  module: {
    rules: [
      {
        exclude: /node_modules/,
        loader: 'babel-loader',
        test: /\.js$/,
      },
      {
        test: /\.css$/,
        use: ExtractTextPlugin.extract({
          fallback: 'style-loader',
          use: 'css-loader',
        }),
      },
      {
        test: /\.(eot|svg|ttf|woff|woff2)$/,
        use: ['file-loader'],
      },
    ],
  },
  plugins: [
    new CopyWebpackPlugin([
      { from: '_locales/**' },
      { from: 'app/img/', to: 'img/' },
      { from: 'app/manifest.json' },
      { from: 'MIT-LICENSE.txt'} ,
      { from: 'README.md' },
    ]),
    new ExtractTextPlugin('popup.css'),
    new webpack.optimize.CommonsChunkPlugin('commons'),
    new HtmlWebpackPlugin({
      cache: false, // Disable cache to ensure file is always created in multi-compiler build
      chunks: ['commons', 'popup'],
      filename: 'popup.html',
      template: './app/popup.template.html',
    }),
    new HtmlWebpackPlugin({
      cache: false, // Disable cache to ensure file is always created in multi-compiler build
      chunks: ['commons', 'background'],
      filename: 'background.html',
      template: './app/background.template.html',
    }),
  ],
};

module.exports = [
  Object.assign({}, COMMON_CONFIG, {
    name: 'chrome',
    output: {
      path: path.join(__dirname, 'dist', 'chrome'),
      filename: '[name].entry.js',
    },
  }),
  Object.assign({}, COMMON_CONFIG, {
    name: 'firefox',
    output: {
      path: path.join(__dirname, 'dist', 'firefox'),
      filename: '[name].entry.js',
    },
  }),
];
