/* eslint-env node */

const ExtractTextPlugin = require('extract-text-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');
const webpack = require('webpack');

module.exports = {
  entry: {
    background: './app/background.js',
    popup: './app/popup.js',
  },
  module: {
    rules: [
      {
        exclude: /node_modules/,
        loader: 'babel-loader',
        query: {
          plugins: ['transform-class-properties'],
          presets: ['es2015', 'react'],
        },
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
  output: {
    path: path.join(__dirname, 'dist'),
    filename: '[name].entry.js',
  },
  plugins: [
    new ExtractTextPlugin('popup.css'),
    new webpack.optimize.CommonsChunkPlugin('commons'),
    new HtmlWebpackPlugin({
      chunks: ['commons', 'popup'],
      filename: 'popup.html',
      template: './app/popup.template.html',
    }),
    new HtmlWebpackPlugin({
      chunks: ['commons', 'background'],
      filename: 'background.html',
      template: './app/background.template.html',
    }),
  ],
};
