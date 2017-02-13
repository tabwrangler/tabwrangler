module.exports = {
  env: {
    browser: true,
    es6: true,
  },
  extends: 'eslint:recommended',
  parser: 'babel-eslint',
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 2015,
    sourceType: 'module',
  },
  plugins: [
    'flowtype',
    'react',
  ],
  rules: {
    // Rules included in ESLint
    'comma-dangle': [1, 'always-multiline'],
    'no-console': 0,
    'no-multi-spaces': 1,
    'no-unused-expressions': 1,
    'no-var': 1,
    'prefer-const': 1,
    'quotes': [1, 'single', {'avoidEscape': true}],

    // Flow rules from eslint-plugin-flowtype
    'flowtype/define-flow-type': 1,

    // React rules from eslint-plugin-react
    'react/jsx-uses-vars': 1,
  },
};
