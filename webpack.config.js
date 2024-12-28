/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-env node */

const CopyWebpackPlugin = require("copy-webpack-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const path = require("path");
const package = require("./package.json");
const webpack = require("webpack");

const COMMON_CONFIG = {
  devtool: "source-map",
  entry: {
    background: "./app/background.ts",
    popup: "./app/popup.tsx",
  },
  mode: "development",
  module: {
    rules: [
      {
        exclude: /node_modules/,
        test: /\.[t|j]sx?$/,
        use: {
          loader: "ts-loader",
        },
      },
      {
        test: /\.s?css$/,
        use: [MiniCssExtractPlugin.loader, "css-loader", "sass-loader"],
      },
      {
        test: /\.woff2?$/i,
        type: "asset/resource",
        dependency: { not: ["url"] },
      },
      {
        test: /\.(svg)$/,
        use: ["file-loader"],
      },
    ],
  },
  optimization: {
    minimizer: [new CssMinimizerPlugin()],
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: "_locales/**" },
        { from: "app/img/", to: "img/" },
        { from: "MIT-LICENSE.txt" },
        { from: "README.md" },
      ],
    }),
    new MiniCssExtractPlugin(),
    new HtmlWebpackPlugin({
      cache: false, // Disable cache to always create file in multi-compiler build
      chunks: ["popup"],
      filename: "popup.html",
      template: "./app/popup.template.html",
    }),
  ],
  resolve: {
    extensions: [".js", ".ts", ".tsx"],
  },
  stats: { children: false },
};

module.exports = [
  Object.assign({}, COMMON_CONFIG, {
    name: "chrome",
    output: {
      path: path.join(__dirname, "dist", "chrome"),
      filename: "[name].entry.js",
    },
    plugins: COMMON_CONFIG.plugins.concat([
      new CopyWebpackPlugin({
        patterns: [
          {
            from: "app/manifest.template.json",
            to: "manifest.json",
            transform(buffer) {
              const manifest = JSON.parse(buffer.toString());

              // Use background script as a ServiceWorker, as required by Chrome's Manifest v3
              // implementation.
              // See https://developer.chrome.com/docs/extensions/migrating/to-service-workers/
              manifest.background = {
                service_worker: "background.entry.js",
              };

              // Sync extension version to the version in package.json.
              manifest.version = package.version;

              return JSON.stringify(manifest, null, 2);
            },
          },
        ],
      }),
      new webpack.DefinePlugin({
        EXTENSION_URL: JSON.stringify(
          "https://chrome.google.com/webstore/detail/egnjhciaieeiiohknchakcodbpgjnchh/",
        ),
        BROWSER: JSON.stringify("chrome"),
      }),
    ]),
  }),
  Object.assign({}, COMMON_CONFIG, {
    name: "firefox",
    output: {
      path: path.join(__dirname, "dist", "firefox"),
      filename: "[name].entry.js",
    },
    plugins: COMMON_CONFIG.plugins.concat([
      new CopyWebpackPlugin({
        patterns: [
          {
            from: "app/manifest.template.json",
            to: "manifest.json",
            transform(buffer) {
              const manifest = JSON.parse(buffer.toString());

              // Use background script as intended because Firefox supports background scripts in
              // its Manifest v3 implementation.
              // See https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Background_scripts
              manifest.background = {
                scripts: ["background.entry.js"],
              };

              // Firefox (Gecko) settings
              // See https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings
              manifest.browser_specific_settings = {
                gecko: {
                  id: "{81b74d53-9416-4fb3-afa2-ab46684b253b}",
                  strict_min_version: "109.0",
                },
              };

              // Sync extension version to the version in package.json.
              manifest.version = package.version;

              // Supports extension popup activation shortcut
              manifest.commands["_execute_action"] = {
                "description": "__MSG_commandWrangleOpenPopup__"
              };

              return JSON.stringify(manifest, null, 2);
            },
          },
        ],
      }),
      new webpack.DefinePlugin({
        EXTENSION_URL: JSON.stringify(
          "https://addons.mozilla.org/en-US/firefox/addon/tabwrangler/",
        ),
        BROWSER: JSON.stringify("firefox"),
      }),
    ]),
  }),
];
