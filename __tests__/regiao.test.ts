import { describe, it, expect } from 'vitest';
import { restritoAOutraRegiao as r } from '@/lib/triagem/regiao';

describe('restritoAOutraRegiao', () => {
  it('descarta município e outro estado', () => {
    expect(r({ titulo: 'CARATINGA  MG - FOMENTO - PROJETOS CULTURAIS - 2026' }).restrito).toBe(true);
    expect(r({ titulo: 'BAHIA - CHAMAMENTO PÚBLICO - PROGRAMA OURO NEGRO - 2027' }).restrito).toBe(true);
    expect(r({ titulo: 'SÃO PAULO - FOMENTO - COOPERAÇÃO FAPESP E ANR' }).restrito).toBe(true);
    expect(r({ titulo: 'Edital Arte na Bagagem - SIM SP 2026' }).restrito).toBe(true);
    expect(r({ titulo: 'Edital 33/2026 Pró-Startups', orgao: 'FACEPE' }).restrito).toBe(true);
    expect(r({ titulo: 'Chamada de apoio', orgao: 'Prefeitura Municipal de Caratinga' }).restrito).toBe(true);
  });
  it('município do Ceará passa', () => {
    expect(r({ titulo: 'FORTALEZA/CE - BOLSA - ARTISTAS - 2026' }).restrito).toBe(false);
    expect(r({ titulo: 'SOBRAL/CE - FOMENTO - CULTURA - 2026' }).restrito).toBe(false);
    expect(r({ titulo: 'Chamada de apoio', orgao: 'Prefeitura Municipal de Sobral' }).restrito).toBe(false);
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

describe('restritoAOutraRegiao: preposição PARA em caixa alta', () => {
  it('não confunde "PARA" com o estado do Pará', () => {
    expect(r({ titulo: 'CHAMADA PÚBLICA PARA ARTISTAS DA CULTURA POPULAR' }).restrito).toBe(false);
    expect(r({ titulo: 'SELEÇÃO INTERNA PARA CONCESSÃO DE BOLSAS DO PROGRAMA INSTITUCIONAL (PIBPG) - CICLO 2026' }).restrito).toBe(false);
  });
  it('continua barrando o Pará escrito com acento', () => {
    expect(r({ titulo: 'PARÁ - CHAMAMENTO PÚBLICO - CULTURA - 2026' }).restrito).toBe(true);
    expect(r({ titulo: 'Pará - Fomento às artes' }).restrito).toBe(true);
  });
});

describe('restritoAOutraRegiao: siglas ambíguas e chamadas nacionais', () => {
  it('o pronome "SE" em caixa alta não vira Sergipe', () => {
    expect(r({ titulo: 'CHAMADA PÚBLICA PARA ARTISTAS QUE SE DESTACAM NA CULTURA POPULAR' }).restrito).toBe(false);
  });
  it('Sergipe como sigla no fim da cabeça continua barrado', () => {
    expect(r({ titulo: 'ARACAJU SE - CHAMAMENTO PÚBLICO - CULTURA - 2026' }).restrito).toBe(true);
    expect(r({ titulo: 'ARACAJU/SE - FOMENTO' }).restrito).toBe(true);
  });
  it('chamada nacional com lista de siglas não vira município', () => {
    expect(r({ titulo: 'Chamada Nacional de Música (SP, RJ, CE)' }).restrito).toBe(false);
  });
});
