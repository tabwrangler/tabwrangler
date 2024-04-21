/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-env node */

const ZipWebpackPlugin = require("zip-webpack-plugin");
const developmentConfig = require("./webpack.config.js");
const packageJson = require("./package.json");

module.exports = developmentConfig.map(function (platformConfig) {
  return Object.assign({}, platformConfig, {
    devtool: false,
    mode: "production",
    plugins: platformConfig.plugins.concat([
      new ZipWebpackPlugin({
        filename: `tabwrangler-${platformConfig.name}-${packageJson.version}.zip`,
        path: "..",
      }),
    ]),
  });
});
