/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.+(ts|js)',
    '**/?(*.)+(spec|test).+(ts|js)',
  ],
  transform: {
    '^.+\.(ts|js)?$': 'ts-jest',
  },
  moduleNameMapper: {
    // Add any module name mappings if needed, e.g., for aliasing imports
  },
  // Add any other Jest configurations as needed
};
