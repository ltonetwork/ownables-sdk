const CopyPlugin = require("copy-webpack-plugin");
const path = require('path');

module.exports = {
  entry: "./bootstrap.js",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "bootstrap.js",
  },
  fallback: {
    util: require.resolve("util/")
  },
  mode: "development",
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: "./assets" },
        'index.html',
        'styles.css',
        '*.js',
      ],
    }),
  ],
};
