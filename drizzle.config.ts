import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './lib/database/schema.ts',
  out: './lib/database/migrations-pg',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
