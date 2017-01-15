/* eslint-env node */

const path = require('path');
const webpack = require('webpack');

const NODE_ENV = process.env.NODE_ENV;
const plugins = [
  new webpack.optimize.CommonsChunkPlugin('commons.chunk.js'),
  new webpack.DefinePlugin({
    'process.env': {
      'NODE_ENV': JSON.stringify(NODE_ENV),
    },
  }),
];
if (NODE_ENV === 'production') {
  plugins.push(
    // Compress and minify JavaScript in production environment.
    new webpack.optimize.UglifyJsPlugin({
      compress: {
        warnings: false,
      },
    })
  );
}

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
          presets: ['es2015', 'react']
        },
        test: /\.js$/,
      },
    ],
  },
  output: {
    path: path.join(__dirname, 'dist'),
    filename: '[name].entry.js',
  },
  plugins,
};
