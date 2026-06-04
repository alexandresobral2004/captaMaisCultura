import bcrypt from 'bcrypt';
import { v4 as uuid } from 'uuid';
import { getRawDb } from './db';

const SALT_ROUNDS = 10;

async function seed() {
  const sqlite = getRawDb();

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'leitor',
      status TEXT NOT NULL DEFAULT 'ativo',
      criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
      atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const adminEmail = 'admin@capta.com';
  const adminSenha = 'admin123';

  const existing = sqlite.prepare('SELECT id FROM usuarios WHERE email = ?').get(adminEmail) as any;

  if (existing) {
    console.log(`⚠️  Usuario admin ja existe (${adminEmail})`);
    return;
  }

  const hashedPassword = await bcrypt.hash(adminSenha, SALT_ROUNDS);
  const id = uuid();

  sqlite.prepare(`
    INSERT INTO usuarios (id, nome, email, password, role, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, 'Administrador', adminEmail, hashedPassword, 'admin', 'ativo');

  console.log(`✅ Admin criado com sucesso!`);
  console.log(`   Email: ${adminEmail}`);
  console.log(`   Senha: ${adminSenha}`);
}

seed().catch(console.error);
