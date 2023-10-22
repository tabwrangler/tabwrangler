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
    ecmaVersion: 2017,
    sourceType: "module",
  },
  plugins: ["@typescript-eslint", "prettier", "react-hooks"],
  root: true,
  rules: {
    // Rules included in ESLint
    "consistent-return": "error",
    eqeqeq: ["error", "smart"],
    "no-console": "off",
    "no-unused-expressions": "error",
    "sort-imports": "error",

    // React Hooks
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "error",

    // TypeScript
    "no-unused-vars": "off", // Note: you must disable the base rule as it can report incorrect errors
    "@typescript-eslint/no-unused-vars": "error",
  },
  settings: {
    react: {
      version: "detect",
    },
  },
};
