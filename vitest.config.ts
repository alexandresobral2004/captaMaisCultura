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
    setupFiles: ['__tests__/setup.ts'],
    include: ['__tests__/**/*.test.ts'],
    testTimeout: 15000,
    // Testes não devem chamar serviços externos nem depender do ambiente do desenvolvedor
    env: { TYPESAFE_API_KEY: '', OPENAI_API_KEY: '' },
  },
});
