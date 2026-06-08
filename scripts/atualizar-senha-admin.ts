import { UsuarioService } from '../lib/database/services/usuario.service';
import { getRawDb } from '../lib/database/db';

async function main() {
  const service = new UsuarioService();
  
  // Buscar o usuário
  const user = getRawDb().prepare("SELECT id FROM usuarios WHERE email = 'admin@teste.com'").get() as any;
  
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
