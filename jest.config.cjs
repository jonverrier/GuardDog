/**
 * Jest configuration for GuardDog tests.
 */
// Copyright (c) 2025 Jon Verrier

/** @type {import('jest').Config} */
const tsJestTransform = {
   '^.+\\.ts$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.jest.json',
      diagnostics: { ignoreCodes: [151002] }
   }]
};

/** @type {import('jest').Config} */
module.exports = {
   projects: [
      {
         displayName: 'unit',
         preset: 'ts-jest',
         testEnvironment: 'node',
         roots: ['<rootDir>/test/unit'],
         testMatch: ['**/*.test.ts'],
         transform: tsJestTransform,
         setupFilesAfterEnv: ['<rootDir>/test/setup/jest.timeout.js'],
         collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts']
      },
      {
         displayName: 'ci',
         preset: 'ts-jest',
         testEnvironment: 'node',
         roots: ['<rootDir>/test/unit'],
         testMatch: ['**/*.test.ts'],
         transform: tsJestTransform,
         setupFilesAfterEnv: ['<rootDir>/test/setup/jest.timeout.js'],
         collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts']
      }
   ]
};
