import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import { v4 as uuid } from 'uuid';
import { join } from 'path';

const dbPath = join(process.cwd(), 'data', 'db', 'editais.db');
const db = new Database(dbPath);

const email = 'admin@captamaiscultura.com.br';
const password = 'Admin@123456';

const hashedPassword = bcrypt.hashSync(password, 10);
const id = uuid();

try {
  const stmt = db.prepare('INSERT INTO usuarios (id, nome, email, password, role, status) VALUES (?, ?, ?, ?, ?, ?)');
  stmt.run(id, 'Administrador', email, hashedPassword, 'admin', 'ativo');
  console.log('✅ Usuário admin criado com sucesso!');
  console.log('Email:', email);
  console.log('Senha:', password);
  console.log('ID:', id);
} catch (err: any) {
  console.error('❌ Erro ao criar usuário:', err.message);
} finally {
  db.close();
}
