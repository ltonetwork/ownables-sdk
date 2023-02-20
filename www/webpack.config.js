const CopyPlugin = require("copy-webpack-plugin");
const path = require('path');
const webpack = require('webpack');

module.exports = {
  entry: "./bootstrap.js",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "bootstrap.js",
  },
  resolve: {
    fallback: {
      util: require.resolve("util/"),
      crypto: require.resolve('crypto-browserify'),
      stream: require.resolve('stream-browserify'),
      buffer: require.resolve("buffer"),
    }
  },
  mode: "development",
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: "./assets", to: "assets/" },
        'index.html',
        'styles.css',
        '*.js',
        { from: "../ownables/*.zip", to: "ownables/" },
      ],
    }),
    new webpack.ProvidePlugin({
      process: 'process/browser',
    }),
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
    }),
  ],
};
