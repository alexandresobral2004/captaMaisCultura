import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { arquivosTs } from './helpers/arquivos';

// Exceções explícitas: nenhum arquivo de app/ ou lib/ pode usar globalThis.__ (estado escondido no processo).
// Lista vazia de propósito. Incluir um caminho aqui exige justificativa.
const EXCECOES: readonly string[] = [];

// Pega globalThis.__x e também o cast antigo: globalThis as unknown as { __x?: ... }
const PADRAO_GLOBALTHIS = /globalThis\s*\.\s*__|globalThis\s+as\s+[^\n]*\{\s*__/;

describe('guarda: sem globalThis.__ em app/ e lib/', () => {
  it('o padrão pega as duas formas de uso do globalThis escondido', () => {
    expect(PADRAO_GLOBALTHIS.test('globalThis.__progresso = 1;')).toBe(true);
    expect(PADRAO_GLOBALTHIS.test('const g = globalThis as unknown as { __progressoBusca?: X };')).toBe(true);
    expect(PADRAO_GLOBALTHIS.test('const fetchOriginal = globalThis.fetch;')).toBe(false);
  });

  it('nenhum arquivo de app/ ou lib/ usa globalThis.__ fora das exceções', () => {
    const raiz = process.cwd();
    const achados = ['app', 'lib']
      .flatMap((pasta) => arquivosTs(path.join(raiz, pasta)))
      .filter((arquivo) => PADRAO_GLOBALTHIS.test(fs.readFileSync(arquivo, 'utf8')))
      .map((arquivo) => path.relative(raiz, arquivo))
      .filter((relativo) => !EXCECOES.includes(relativo));

    expect(achados).toEqual([]);
  });
});
