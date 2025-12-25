module.exports = {
  root: true,
  env: {
    node: true,
    es2020: true,
    jest: true
  },
  parser: '@typescript-eslint/parser',
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  plugins: ['@typescript-eslint'],
  rules: {}
};
