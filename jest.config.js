module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/commands/add.js',
    '!src/commands/edit.js'
  ],
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  modulePathIgnorePatterns: [
    'node_modules'
  ],
  clearMocks: true,
  restoreMocks: true
};
