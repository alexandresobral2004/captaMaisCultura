import bcrypt from 'bcrypt';
import { randomUUID as uuid } from 'crypto';
import { db } from './db';
import { usuarios } from './schema';
import { eq } from 'drizzle-orm';

const SALT_ROUNDS = 10;

async function seed() {
  const adminEmail = 'admin@capta.com';
  const adminSenha = 'admin123';

  const existing = await db.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.email, adminEmail));

  if (existing.length > 0) {
    console.log(`⚠️  Usuario admin ja existe (${adminEmail})`);
    return;
  }

  const hashedPassword = await bcrypt.hash(adminSenha, SALT_ROUNDS);
  const id = uuid();

  await db.insert(usuarios).values({
    id,
    nome: 'Administrador',
    email: adminEmail,
    password: hashedPassword,
    role: 'admin',
    status: 'ativo',
  });

  console.log(`✅ Admin criado com sucesso!`);
  console.log(`   Email: ${adminEmail}`);
  console.log(`   Senha: ${adminSenha}`);
}

seed().catch(console.error);
