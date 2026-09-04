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
      },
    },
  ],
};
