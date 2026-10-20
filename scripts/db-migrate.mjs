/**
 * Cria/atualiza as tabelas no Postgres aplicando as migrations de lib/database/migrations-pg.
 *
 * Uso:
 *   DATABASE_URL=postgres://... node scripts/db-migrate.mjs
 *   (ou npm run db:migrate; no Railway roda como Pre-deploy Command, configurado no serviço)
 *   Em JavaScript puro para não depender do tsx (devDependency) na imagem de produção.
 *
 * Idempotente: o drizzle registra o que já rodou em drizzle.__drizzle_migrations e só aplica
 * as novas. Para mudar o schema: editar schema.ts, rodar `npm run db:generate`, revisar o SQL
 * gerado e commitar junto.
 */
import path from 'node:path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const PASTA_MIGRATIONS = path.join(process.cwd(), 'lib', 'database', 'migrations-pg');

async function main() {
  if (!DATABASE_URL.startsWith('postgres')) {
    console.error('❌ DATABASE_URL precisa apontar para um Postgres (postgres://...).');
    process.exit(1);
  }

  const isLocalhost = DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1');
  const client = postgres(DATABASE_URL, { ssl: isLocalhost ? false : 'require', max: 1, onnotice: () => {} });

  try {
    // Banco criado antes por `drizzle-kit push` não tem o registro de migrations: rodar 0000 falharia com "already exists"
    const [{ tabelas, registro }] = await client`
      SELECT
        (SELECT count(*)::int FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'editais') AS tabelas,
        (SELECT count(*)::int FROM information_schema.tables WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations') AS registro`;
    if (tabelas > 0 && registro === 0) {
      console.error('❌ O banco já tem tabelas, mas não tem o registro de migrations (provavelmente criado por drizzle-kit push).');
      console.error('   Use um banco vazio ou registre a migration inicial manualmente antes de continuar.');
      process.exit(1);
    }

    console.log(`🗄️  Aplicando migrations de ${path.relative(process.cwd(), PASTA_MIGRATIONS)}...`);
    await migrate(drizzle(client), { migrationsFolder: PASTA_MIGRATIONS });

    const [{ total }] = await client`
      SELECT count(*)::int AS total FROM information_schema.tables WHERE table_schema = 'public'`;
    console.log(`✅ Schema em dia: ${total} tabelas no schema public.`);
  } finally {
    await client.end();
  }
}

main().catch((erro) => {
  console.error('❌ Falha ao aplicar migrations:', erro);
  process.exit(1);
});
