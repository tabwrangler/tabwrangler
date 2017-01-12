const webpack = require('webpack');
const path = require('path');

module.exports = {
  entry: {
    background: './app/background.js',
    pageaction: './app/pageaction.js',
    popup: './app/popup.js'
  },
  module: {
    loaders: [
      {
        exclude: /node_modules/,
        loader: 'babel-loader',
        query: {
          plugins: ['transform-class-properties'],
          presets: ['es2015', 'react']
        },
        test: /\.js$/
      }
    ]
  },
  plugins: [
    new webpack.optimize.CommonsChunkPlugin('commons.chunk.js'),
    new webpack.DefinePlugin({
      'process.env': {
        'NODE_ENV': JSON.stringify('production')
      }
    })
  ],
  output: {
    path: path.join(__dirname, 'dist'),
    filename: '[name].entry.js'
  }
};
