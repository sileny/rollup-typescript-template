module.exports = {
  globals: {
    __VERSION__: true,
  },
  parser: '@typescript-eslint/parser',
  env: {
    browser: true,
    node: true
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 0,
    '@typescript-eslint/no-empty-function': 0,
    '@typescript-eslint/ban-types': 0,
    '@typescript-eslint/explicit-module-boundary-types': 0
  }
};
