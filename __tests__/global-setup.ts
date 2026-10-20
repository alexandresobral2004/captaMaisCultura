import { execSync } from 'child_process';

const DB_URL = process.env.DATABASE_URL ?? '';

export async function setup() {
  if (!DB_URL.startsWith('postgres')) return;

  // Aplica schema no banco de teste (cria/atualiza tabelas sem dados)
  execSync('npx drizzle-kit push --force', {
    env: { ...process.env },
    stdio: 'pipe',
  });
}

export async function teardown() {}
