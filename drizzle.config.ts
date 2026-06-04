import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './lib/database/schema.ts',
  out: './lib/database/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: './data/db/editais.db',
  },
  verbose: true,
  strict: true,
});
