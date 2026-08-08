module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/__tests__'],
  moduleNameMapper: {
    '^bullmq$': '<rootDir>/src/vendor/bullmq.ts',
    // Resolve TypeScript ESM .js imports to their .ts source files
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
