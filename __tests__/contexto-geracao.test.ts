import { describe, it, expect } from 'vitest';
import { proponenteDoProjeto, editalDoProjeto, elegibilidadeParaLista, ProponenteAusenteError } from '../lib/projetos/contexto-geracao';

describe('contexto de geração', () => {
  it('exige o nome do proponente', () => {
    expect(() => proponenteDoProjeto({})).toThrow(ProponenteAusenteError);
    expect(() => proponenteDoProjeto({ nomeProponente: '  ' })).toThrow(ProponenteAusenteError);
    const p = proponenteDoProjeto({ nomeProponente: 'Associação X' });
    expect(p.cnpj).toBe('');
    expect(p.projetosAnteriores).toEqual([]);
  });
  it('inclui a restrição de participação na elegibilidade', () => {
    const l = elegibilidadeParaLista({ tiposProponentes: ['ICT'], restritoA: 'Institutos Federais' });
    expect(l.join(' ')).toContain('Institutos Federais');
  });
  it('lê o edital analisado', () => {
    const e = editalDoProjeto({
      titulo: 'Chamada X', orgao: 'CNPq', valorMax: '100000', areasTematicas: '["IA"]',
      analiseIA: { objetivo: 'Fomentar', criteriosAvaliacao: ['Mérito'], secoesRequeridas: ['Justificativa'] },
    });
    expect(e.valorMax).toBe(100000);
    expect(e.areasTematicas).toEqual(['IA']);
    expect(e.secoesRequeridas).toEqual(['Justificativa']);
  });
});
