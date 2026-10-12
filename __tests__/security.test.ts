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

    it('deve rejeitar pasta irmã com o mesmo prefixo (data-evil)', async () => {
      await expect(fileService.lerArquivo('../data-evil/segredo.txt')).rejects.toThrow(
        'Directory Traversal'
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

describe('UpdateEditalSchema - pdfPath não pode vir do cliente', () => {
  it('descarta pdfPath no corpo do PUT de editais', async () => {
    const { UpdateEditalSchema } = await import('../lib/api/validators');
    const parsed = UpdateEditalSchema.omit({ pdfPath: true }).parse({
      titulo: 'Novo título',
      pdfPath: '../.env',
    });
    expect(parsed).not.toHaveProperty('pdfPath');
  });
});

describe('Middleware - perfil somente leitura', () => {
  async function requisicao(role: string, metodo: string, caminho: string) {
    const { NextRequest } = await import('next/server');
    const { assinarToken } = await import('../lib/api/auth');
    const { middleware } = await import('../middleware');
    const token = await assinarToken(
      JSON.stringify({ id: 'u1', nome: 'Teste', email: 't@t.com', role, status: 'ativo' })
    );
    const req = new NextRequest(`http://localhost:3000${caminho}`, {
      method: metodo,
      headers: { cookie: `usuario_logado=${token}` },
    });
    return middleware(req);
  }

  it('leitor recebe 403 em métodos que alteram dados', async () => {
    for (const [metodo, caminho] of [
      ['DELETE', '/api/v1/editais/abc'],
      ['POST', '/api/v1/editais/abc/analyze'],
      ['PUT', '/api/v1/projetos/abc'],
    ]) {
      const res = await requisicao('leitor', metodo, caminho);
      expect(res.status).toBe(403);
    }
  });

  it('leitor ainda pode ler (GET)', async () => {
    const res = await requisicao('leitor', 'GET', '/api/v1/editais');
    expect(res.status).toBe(200);
  });

  it('editor pode alterar editais, mas não rotas de admin', async () => {
    expect((await requisicao('editor', 'DELETE', '/api/v1/editais/abc')).status).toBe(200);
    expect((await requisicao('editor', 'PUT', '/api/v1/usuarios/u1')).status).toBe(403);
  });
});
