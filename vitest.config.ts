import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    globalSetup: '__tests__/global-setup.ts',
    setupFiles: ['__tests__/setup.ts'],
    include: ['__tests__/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    // Testes não devem chamar serviços externos nem depender do ambiente do desenvolvedor
    env: { TYPESAFE_API_KEY: '', JEV_API_KEY: '', OPENAI_API_KEY: '' },
  },
});
