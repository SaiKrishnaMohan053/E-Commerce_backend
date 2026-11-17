module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 30000,
  coverageThreshold: {
    global: { statements: 60, branches: 55, functions: 50, lines: 60 },
  },
};
