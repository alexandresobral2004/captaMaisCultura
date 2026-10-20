import { UsuarioService } from '../lib/database/services/usuario.service';
import { db } from '../lib/database/db';
import { usuarios } from '../lib/database/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const service = new UsuarioService();

  // Buscar o usuário
  const rows = await db.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.email, 'admin@teste.com'));
  const user = rows[0] as any;
  
  if (user) {
    console.log('Usuário admin@teste.com encontrado. Atualizando a senha...');
    await service.atualizarSenha(user.id, 'admin123');
    console.log('✅ Senha atualizada com sucesso para admin123!');
  } else {
    console.log('Usuário admin@teste.com não encontrado. Cadastrando novo administrador...');
    const result = await service.cadastrar({
      nome: 'Admin Teste',
      email: 'admin@teste.com',
      password: 'admin123',
      confirmarPassword: 'admin123'
    });
    console.log('✅ Novo administrador cadastrado:', result.email);
  }
}

main().catch(console.error);
