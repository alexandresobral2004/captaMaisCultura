import { describe, it, expect } from 'vitest';
import { restritoAOutraRegiao as r } from '@/lib/triagem/regiao';

describe('restritoAOutraRegiao', () => {
  it('descarta município e outro estado', () => {
    expect(r({ titulo: 'CARATINGA  MG - FOMENTO - PROJETOS CULTURAIS - 2026' }).restrito).toBe(true);
    expect(r({ titulo: 'FORTALEZA/CE - BOLSA - ARTISTAS - 2026' }).restrito).toBe(true);
    expect(r({ titulo: 'BAHIA - CHAMAMENTO PÚBLICO - PROGRAMA OURO NEGRO - 2027' }).restrito).toBe(true);
    expect(r({ titulo: 'SÃO PAULO - FOMENTO - COOPERAÇÃO FAPESP E ANR' }).restrito).toBe(true);
    expect(r({ titulo: 'Edital Arte na Bagagem - SIM SP 2026' }).restrito).toBe(true);
    expect(r({ titulo: 'Edital 33/2026 Pró-Startups', orgao: 'FACEPE' }).restrito).toBe(true);
    expect(r({ titulo: 'Chamada de apoio', orgao: 'Prefeitura Municipal de Caratinga' }).restrito).toBe(true);
  });
  it('mantém Ceará, Nordeste e Brasil', () => {
    expect(r({ titulo: 'CEARÁ - FOMENTO - PROJETOS CULTURAIS - 2026' }).restrito).toBe(false);
    expect(r({ titulo: 'Chamada Pública CNPq/CAPES Nº 30/2026 - Mestrado e Doutorado', orgao: 'CNPq' }).restrito).toBe(false);
    expect(r({ titulo: 'Edital Nordeste Digital - BA e PE' }).restrito).toBe(false);
    expect(r({ titulo: 'Chamada FUNCAP 2026', orgao: 'FUNCAP' }).restrito).toBe(false);
  });
});

import { classificarAbrangencia } from '@/lib/triagem/regiao';
describe('classificarAbrangencia', () => {
  it('Ceará, Nordeste ou Brasil', () => {
    expect(classificarAbrangencia({ titulo: 'Chamada FUNCAP 2026', orgao: 'FUNCAP' })).toBe('Ceará');
    expect(classificarAbrangencia({ titulo: 'CEARÁ - FOMENTO - CULTURA' })).toBe('Ceará');
    expect(classificarAbrangencia({ titulo: 'Programa Nordeste Digital' })).toBe('Nordeste');
    expect(classificarAbrangencia({ titulo: 'Chamada CNPq Nº 30/2026', orgao: 'CNPq' })).toBe('Brasil');
    expect(classificarAbrangencia({ titulo: 'X', abrangencia: 'Nordeste' })).toBe('Nordeste');
  });
});
