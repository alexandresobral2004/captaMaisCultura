import { describe, it, expect } from 'vitest';
import { LoginUsuarioSchema, CadastroUsuarioSchema } from '../lib/api/validators';

// 256 caracteres no total: acima do limite de 254 do e-mail
const emailLongo = `${'a'.repeat(250)}@t.com`;
const emailCurto = 'pessoa@teste.com';

const cadastro = (email: string) => ({
  nome: 'Teste',
  email,
  password: 'Senha@1234',
  confirmarPassword: 'Senha@1234',
});

describe('validators de e-mail: tamanho máximo', () => {
  it('login aceita e-mail curto (controle) e rejeita com mais de 254 caracteres', () => {
    expect(LoginUsuarioSchema.safeParse({ email: emailCurto, password: 'x' }).success).toBe(true);
    expect(LoginUsuarioSchema.safeParse({ email: emailLongo, password: 'x' }).success).toBe(false);
  });

  it('cadastro aceita e-mail curto (controle) e rejeita com mais de 254 caracteres', () => {
    expect(CadastroUsuarioSchema.safeParse(cadastro(emailCurto)).success).toBe(true);
    expect(CadastroUsuarioSchema.safeParse(cadastro(emailLongo)).success).toBe(false);
  });
});
