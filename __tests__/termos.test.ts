import { describe, it, expect } from 'vitest';
import { contemTermo, contarTermo } from '../lib/scraper/filtros/termos';
import { analisarBlacklist } from '../lib/scraper/filtros/blacklist-engine';
import { validarWhitelistTI } from '../lib/filtros-ti/whitelist';
import { termosCulturaEncontrados } from '../lib/triagem/cultura';

describe('contemTermo: palavra inteira', () => {
  it('não casa dentro de outra palavra', () => {
    expect(contemTermo('modalidade de fomento', 'moda')).toBe(false);
    expect(contemTermo('capital semente', 'api')).toBe(false);
    expect(contemTermo('parte dos participantes', 'arte')).toBe(false);
  });
  it('casa palavra, plural simples e frase', () => {
    expect(contemTermo('feira de moda', 'moda')).toBe(true);
    expect(contemTermo('as artes visuais', 'arte')).toBe(true);
    expect(contemTermo('uso de ci/cd e docker', 'ci/cd')).toBe(true);
    expect(contemTermo('banco de dados relacional', 'banco de dados')).toBe(true);
  });
  it('conta ocorrências e resiste ao estado do regex entre chamadas', () => {
    expect(contarTermo('obra e obra, obras', 'obra')).toBe(3);
    expect(contemTermo('obra', 'obra')).toBe(true);
    expect(contemTermo('obra', 'obra')).toBe(true);
  });
});

describe('listas de termos sem falso positivo por substring', () => {
  it('blacklist: modalidade, cobrança e legalidade não penalizam', () => {
    for (const t of ['Edital com modalidade de fomento a startups', 'Software de cobrança', 'Segurança, legalidade e LGPD']) {
      expect(analisarBlacklist(t, '').scoreNegativo).toBe(0);
    }
  });
  it('blacklist: a palavra inteira continua penalizando', () => {
    expect(analisarBlacklist('Edital de moda e vestuário', '').scoreNegativo).toBeGreaterThan(0);
  });
  it('whitelist: "api" não casa em "capital" nem "carta" em "descartáveis"', () => {
    expect(validarWhitelistTI('Capital semente para negócios', '').termosBranco).not.toContain('api');
    expect(validarWhitelistTI('Itens descartáveis', '').termosBranco).not.toContain('carta');
    expect(validarWhitelistTI('API de pagamentos', '').termosBranco).toContain('api');
  });
  it('cultura: "arte" não casa em "parte"; artístico e artes continuam', () => {
    expect(termosCulturaEncontrados('Parte dos participantes do quarteto', '')).toEqual([]);
    expect(termosCulturaEncontrados('Edital de formação artística', '')).toContain('artística');
    expect(termosCulturaEncontrados('Edital de artes visuais', '')).toContain('artes visuais');
  });
});
