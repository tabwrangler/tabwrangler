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
    'comma-dangle': [2, 'always-multiline'],
    'eqeqeq': [2, 'smart'],
    'indent': [2, 2],
    'no-console': 0,
    'no-multi-spaces': 2,
    'no-unused-expressions': 2,
    'no-var': 2,
    'object-shorthand': 2,
    'prefer-const': 2,
    'quotes': [2, 'single', {'avoidEscape': true}],

    // Flow rules from eslint-plugin-flowtype
    'flowtype/define-flow-type': 2,

    // React rules from eslint-plugin-react
    'react/jsx-uses-vars': 2,
  },
};
