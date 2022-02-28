module.exports = {
  env: {
    browser: true,
    es6: true,
    jest: true,
    node: true,
    webextensions: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:flowtype/recommended",
    "plugin:react/recommended",
    "plugin:prettier/recommended",
    "prettier",
  ],
  parser: "@babel/eslint-parser",
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 2015,
    sourceType: "module",
  },
  plugins: ["prettier", "react-hooks"],
  rules: {
    // Rules included in ESLint
    "comma-dangle": [2, "always-multiline"],
    "consistent-return": 2,
    eqeqeq: [2, "smart"],
    "jsx-quotes": [2, "prefer-double"],
    "max-len": [2, { code: 100, ignoreUrls: true }],
    "no-console": 0,
    "no-multi-spaces": 2,
    "no-trailing-spaces": 2,
    "no-unused-expressions": 2,
    "no-var": 2,
    "object-shorthand": 2,
    "prefer-const": 2,
    "quote-props": [2, "as-needed", { numbers: true }], // Require for numbers to appease Flow
    semi: 2,
    "sort-imports": 2,

    // React
    "react/prop-types": 0,

    // React Hooks
    "react-hooks/rules-of-hooks": 2,
    "react-hooks/exhaustive-deps": 2,
  },
  settings: {
    react: {
      version: "detect",
    },
  },
};
