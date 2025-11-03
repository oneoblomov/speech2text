module.exports = {
  env: {
    browser: false,
    es2021: true,
    node: false,
    'gjs': true
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module'
  },
  rules: {
    'no-unused-vars': 'warn',
    'no-console': 'off',
    'indent': ['error', 4],
    'linebreak-style': ['error', 'unix'],
    'quotes': ['error', 'single'],
    'semi': ['error', 'always']
  },
  globals: {
    global: 'readonly',
    log: 'readonly',
    logError: 'readonly'
  }
};