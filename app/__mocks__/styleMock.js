/* @flow */

// This file ensures React Components can import CSS files like `import './Styles.css'` inside the
// Jest environment and bypass the need for a CSS preprocessor. Instead, this file is loaded as the
// CSS dependency and nothing happens.

const styleMock: { [key: string]: any } = {};
module.exports = styleMock;
