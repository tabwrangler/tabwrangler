module.exports = {
  env: {
    browser: true,
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
    'react',
  ],
  rules: {
    'comma-dangle': [1, 'always-multiline'],
    'no-console': 0,
    'no-var': 1,
    'prefer-const': 1,
    'react/jsx-uses-vars': 1,
  },
};
