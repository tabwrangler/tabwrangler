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
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:prettier/recommended",
    "prettier/react",
    "prettier/standard",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 2015,
    sourceType: "module",
  },
  plugins: ["@typescript-eslint", "prettier", "react-hooks"],
  root: true,
  rules: {
    // Rules included in ESLint
    "consistent-return": 2,
    eqeqeq: [2, "smart"],
    "no-console": 0,
    "no-unused-expressions": 2,
    "sort-imports": 2,

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
