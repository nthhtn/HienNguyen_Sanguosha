module.exports = {
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
      },
    },
  ],
};
