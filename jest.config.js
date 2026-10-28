module.exports = {
  // Used only by `npm run test:coverage`. The 90% floor is checked by scripts/check-coverage.mjs, so it can gate separately from the tests.
  collectCoverageFrom: ['projects/*/src/**/*.ts', '!**/*.spec.ts', '!**/*.d.ts', '!**/public-api.ts'],
  coverageReporters: ['text-summary', 'json-summary', 'lcov'],
  projects: [
    {
      displayName: 'engine',
      preset: 'ts-jest',
      testEnvironment: 'node',
      rootDir: 'projects/engine/src',
      testMatch: ['**/*.spec.ts'],
    },
    {
      displayName: 'content',
      preset: 'ts-jest',
      testEnvironment: 'node',
      rootDir: 'projects/content/src',
      testMatch: ['**/*.spec.ts'],
      moduleNameMapper: {
        '^engine$': '<rootDir>/../../engine/src/public-api.ts',
      },
    },
    {
      displayName: 'sim',
      preset: 'ts-jest',
      testEnvironment: 'node',
      rootDir: 'projects/sim/src',
      testMatch: ['**/*.spec.ts'],
      moduleNameMapper: {
        '^engine$': '<rootDir>/../../engine/src/public-api.ts',
        '^content$': '<rootDir>/../../content/src/public-api.ts',
        '^bots$': '<rootDir>/../../bots/src/public-api.ts',
      },
    },
    {
      displayName: 'bots',
      preset: 'ts-jest',
      testEnvironment: 'node',
      rootDir: 'projects/bots/src',
      testMatch: ['**/*.spec.ts'],
      moduleNameMapper: {
        '^engine$': '<rootDir>/../../engine/src/public-api.ts',
        '^content$': '<rootDir>/../../content/src/public-api.ts',
      },
    },
    {
      displayName: 'protocol',
      preset: 'ts-jest',
      testEnvironment: 'node',
      rootDir: 'projects/protocol/src',
      testMatch: ['**/*.spec.ts'],
      moduleNameMapper: {
        '^engine$': '<rootDir>/../../engine/src/public-api.ts',
      },
    },
    {
      displayName: 'server',
      preset: 'ts-jest',
      testEnvironment: 'node',
      rootDir: 'projects/server/src',
      testMatch: ['**/*.spec.ts'],
      moduleNameMapper: {
        '^engine$': '<rootDir>/../../engine/src/public-api.ts',
        '^content$': '<rootDir>/../../content/src/public-api.ts',
        '^bots$': '<rootDir>/../../bots/src/public-api.ts',
        '^protocol$': '<rootDir>/../../protocol/src/public-api.ts',
        '^protocol/schemas$': '<rootDir>/../../protocol/src/schemas/index.ts',
      },
    },
    {
      displayName: 'app',
      preset: 'jest-preset-angular',
      testEnvironment: 'jsdom',
      rootDir: 'projects/app',
      testMatch: ['<rootDir>/src/**/*.spec.ts'],
      setupFilesAfterEnv: ['<rootDir>/../../jest.setup.app.ts'],
      moduleNameMapper: {
        '^engine$': '<rootDir>/../engine/src/public-api.ts',
        '^content$': '<rootDir>/../content/src/public-api.ts',
        '^bots$': '<rootDir>/../bots/src/public-api.ts',
        '^protocol$': '<rootDir>/../protocol/src/public-api.ts',
      },
    },
  ],
};
