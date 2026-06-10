import { describe, it, expect } from 'vitest';
import { assinarToken, verificarToken } from '../lib/api/auth';
import { FileService } from '../lib/database/services/file.service';
import { CadastroUsuarioSchema, LoginUsuarioSchema } from '../lib/api/validators';

describe('Validação de Funcionalidades de Segurança', () => {
  describe('Assinatura e Verificação de Cookies de Sessão', () => {
    it('deve assinar e verificar um token com sucesso', async () => {
      const payload = JSON.stringify({ id: '123', role: 'admin' });
      const token = await assinarToken(payload);
      
      expect(token).toContain('.');
      
      const verificado = await verificarToken(token);
      expect(verificado).toBe(payload);
    });

    it('deve rejeitar um token adulterado', async () => {
      const payload = JSON.stringify({ id: '123', role: 'leitor' });
      const token = await assinarToken(payload);
      
      const partes = token.split('.');
      // Alterar payload sem alterar assinatura
      const payloadAdulterado = JSON.stringify({ id: '123', role: 'admin' });
      const tokenAdulterado = `${payloadAdulterado}.${partes[1]}`;
      
      const verificado = await verificarToken(tokenAdulterado);
      expect(verificado).toBeNull();
    });

    it('deve rejeitar estruturas de tokens inválidas', async () => {
      expect(await verificarToken('token_invalido_sem_ponto')).toBeNull();
      expect(await verificarToken('tres.partes.token')).toBeNull();
    });
  });

  describe('Proteção contra Directory Traversal', () => {
    const fileService = new FileService();

    it('deve impedir leitura ou escrita fora do diretório de dados', async () => {
      await expect(fileService.lerArquivo('../../etc/passwd')).rejects.toThrow(
        'Acesso negado: Tentativa de Directory Traversal detectada.'
      );
      await expect(fileService.deletarArquivo('../arquivo_externo.txt')).rejects.toThrow(
        'Acesso negado: Tentativa de Directory Traversal detectada.'
      );
    });
  });

  describe('Validação Zod - Cadastro e Login', () => {
    it('deve aprovar dados de cadastro válidos', () => {
      const usuarioValido = {
        nome: 'Segurança Web',
        email: 'seguranca@cultura.gov.br',
        password: 'SuperPassword123!',
        confirmarPassword: 'SuperPassword123!',
      };
      
      const resultado = CadastroUsuarioSchema.safeParse(usuarioValido);
      expect(resultado.success).toBe(true);
    });

    it('deve rejeitar cadastro com senhas que não coincidem', () => {
      const usuarioInvalido = {
        nome: 'Segurança Web',
        email: 'seguranca@cultura.gov.br',
        password: 'SuperPassword123!',
        confirmarPassword: 'DiferentePassword123!',
      };
      
      const resultado = CadastroUsuarioSchema.safeParse(usuarioInvalido);
      expect(resultado.success).toBe(false);
      if (!resultado.success) {
        expect(resultado.error.issues[0].message).toBe('As senhas não coincidem');
      }
    });

    it('deve rejeitar senhas fracas no cadastro', () => {
      const senhasFracas = [
        '1234567', // Menos de 8 caracteres
        'sem_maiuscula_1!', // Sem letra maiúscula
        'SEM_MINISCULA_1!', // Sem letra minúscula
        'SemEspecial123', // Sem caractere especial
        'SemNumeroXxx!', // Sem número
      ];

      senhasFracas.forEach((password) => {
        const usuario = {
          nome: 'Segurança Web',
          email: 'seguranca@cultura.gov.br',
          password,
          confirmarPassword: password,
        };
        const resultado = CadastroUsuarioSchema.safeParse(usuario);
        expect(resultado.success).toBe(false);
      });
    });

    it('deve rejeitar e-mails em formato inválido', () => {
      const emailsInvalidos = ['emailsemarroba.com', 'email@', '@dominio.com'];
      
      emailsInvalidos.forEach((email) => {
        const usuario = {
          nome: 'Segurança Web',
          email,
          password: 'SuperPassword123!',
          confirmarPassword: 'SuperPassword123!',
        };
        const resultado = CadastroUsuarioSchema.safeParse(usuario);
        expect(resultado.success).toBe(false);
      });
    });
  });
});
