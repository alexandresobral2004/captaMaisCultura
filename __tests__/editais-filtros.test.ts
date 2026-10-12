import { describe, it, expect } from 'vitest';
import { filtrarEOrdenarEditais, FILTROS_INICIAIS } from '@/lib/editais/filtros';
import type { Edital } from '@/components/editais/tipos';

const base = { orgao: 'Secretaria', valor: '', dataLimite: '2030-01-01', status: 'aberto', descricao: '', link: '' };
const ed = (o: Partial<Edital> & { id: string; titulo: string }) => ({ ...base, ...o }) as Edital;

const lista = [
  ed({ id: '1', titulo: 'Festival de teatro', categoriaArea: 'Cultura', criadoEm: '2026-01-01' }),
  ed({ id: '2', titulo: 'Bolsa de pesquisa em software', categoriaArea: 'Pesquisa', criadoEm: '2026-03-01' }),
  ed({ id: '3', titulo: 'Edital antigo sem eixo', criadoEm: '2025-01-01' }),
  ed({ id: '4', titulo: 'Descartado', statusAnalise: 'descartado' }),
];

describe('filtrarEOrdenarEditais', () => {
  it('esconde descartados e ordena por mais recentes', () => {
    const r = filtrarEOrdenarEditais(lista, FILTROS_INICIAIS);
    expect(r.map(e => e.id)).toEqual(['2', '1', '3']);
  });

  it('ordena por antigos', () => {
    const r = filtrarEOrdenarEditais(lista, { ...FILTROS_INICIAIS, ordenacao: 'antigos' });
    expect(r.map(e => e.id)).toEqual(['3', '1', '2']);
  });

  it('filtra por eixo e conta edital sem eixo como Cultura', () => {
    const cultura = filtrarEOrdenarEditais(lista, { ...FILTROS_INICIAIS, eixo: 'Cultura' });
    expect(cultura.map(e => e.id).sort()).toEqual(['1', '3']);
    const pesquisa = filtrarEOrdenarEditais(lista, { ...FILTROS_INICIAIS, eixo: 'Pesquisa' });
    expect(pesquisa.map(e => e.id)).toEqual(['2']);
  });

  it('busca por texto no título', () => {
    const r = filtrarEOrdenarEditais(lista, { ...FILTROS_INICIAIS, busca: 'teatro' });
    expect(r.map(e => e.id)).toEqual(['1']);
  });
});
