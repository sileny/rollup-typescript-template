/*
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/en/configuration.html
 */

export default {
  collectCoverage: true,
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  moduleFileExtensions: ['js', 'ts'],
  testMatch: ['**/*.spec.ts'],
  moduleNameMapper: {},
  globals: {
    'ts-jest': {
      tsconfig: './tsconfig.json',
      diagnostics: false
    }
  }
}
