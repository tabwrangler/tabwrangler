/* eslint-env node */

const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const path = require('path');
const webpack = require('webpack');

const COMMON_CONFIG = {
  devtool: 'cheap-module-source-map',
  entry: {
    background: './app/background.js',
    popup: './app/popup.js',
  },
  mode: 'development',
  module: {
    rules: [
      {
        exclude: /node_modules/,
        test: /\.js$/,
        use: {
          loader: 'babel-loader',
        },
      },
      {
        test: /\.s?css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader', 'sass-loader'],
      },
      {
        test: /\.(eot|svg|ttf|woff|woff2)$/,
        use: ['file-loader'],
      },
    ],
  },
  optimization: {
    splitChunks: {
      cacheGroups: {
        commons: {
          chunks: 'initial',
          minChunks: 2,
          name: 'commons',
        },
      },
    },
  },
  plugins: [
    new CopyWebpackPlugin([
      { from: '_locales/**' },
      { from: 'app/img/', to: 'img/' },
      { from: 'app/manifest.json' },
      { from: 'MIT-LICENSE.txt' },
      { from: 'README.md' },
    ]),
    new MiniCssExtractPlugin({
      filename: '[name].css',
    }),
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
    plugins: COMMON_CONFIG.plugins.concat([
      new webpack.DefinePlugin({
        EXTENSION_URL: JSON.stringify(
          'https://chrome.google.com/webstore/detail/egnjhciaieeiiohknchakcodbpgjnchh/'
        ),
      }),
    ]),
  }),
  Object.assign({}, COMMON_CONFIG, {
    name: 'firefox',
    output: {
      path: path.join(__dirname, 'dist', 'firefox'),
      filename: '[name].entry.js',
    },
    plugins: COMMON_CONFIG.plugins.concat([
      new webpack.DefinePlugin({
        EXTENSION_URL: JSON.stringify(
          'https://addons.mozilla.org/en-US/firefox/addon/tabwrangler/'
        ),
      }),
    ]),
  }),
];
