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
    },
  ],
};
