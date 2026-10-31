import { describe, it, expect } from 'vitest';
import { opcaoSslPostgres } from '../../lib/database/ssl';

describe('opcaoSslPostgres', () => {
  it('exige TLS para um banco remoto', () => {
    expect(opcaoSslPostgres('postgres://u:p@db.railway.internal:5432/app', {})).toBe('require');
  });

  it('desliga TLS para localhost e 127.0.0.1 sem configuração extra', () => {
    expect(opcaoSslPostgres('postgres://u:p@localhost:5433/captadb', {})).toBe(false);
    expect(opcaoSslPostgres('postgres://u:p@127.0.0.1:5433/captadb', {})).toBe(false);
  });

  it('desliga TLS quando DATABASE_SSL=disable, mesmo para host remoto', () => {
    expect(
      opcaoSslPostgres('postgres://u:p@host.docker.internal:5433/captadb', { DATABASE_SSL: 'disable' })
    ).toBe(false);
  });

  it('ignora valores desconhecidos de DATABASE_SSL e mantém a regra padrão', () => {
    expect(
      opcaoSslPostgres('postgres://u:p@db.railway.internal:5432/app', { DATABASE_SSL: 'talvez' })
    ).toBe('require');
  });
});
