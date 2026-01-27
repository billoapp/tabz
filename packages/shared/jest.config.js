module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/lib'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/__tests__/**/*.tsx',
    '**/?(*.)+(spec|test).ts',
    '**/?(*.)+(spec|test).tsx'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest',
    '^.+\\.tsx$': 'ts-jest',
  },
  collectCoverageFrom: [
    'lib/**/*.ts',
    'lib/**/*.tsx',
    '!lib/**/*.d.ts',
    '!lib/**/__tests__/**',
    '!lib/**/index.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testTimeout: 10000,
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/$1',
  },
};