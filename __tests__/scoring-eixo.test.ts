import { describe, it, expect } from 'vitest';
import { calcularPontuacaoEdital } from '@/lib/ai/scoring';

const base = {
  titulo: 'Edital de apoio a festivais de teatro e dança',
  descricao: 'Fomento a projetos culturais, apresentações e oficinas',
  url: 'https://exemplo.org/edital',
  pdfEncontrado: false,
  pdfReal: false,
};

describe('calcularPontuacaoEdital por eixo', () => {
  it('em Cultura não cobra whitelist nem blacklist de TI', async () => {
    const r = await calcularPontuacaoEdital({ ...base, eixo: 'Cultura' });
    expect(r.motivos).toContain('Eixo Cultura: termos de TI não se aplicam');
    expect(r.motivos.some(m => m.includes('blacklist'))).toBe(false);
    expect(r.scoreFinal).toBeGreaterThanOrEqual(30);
  });

  it('sem eixo mantém a whitelist de TI', async () => {
    const r = await calcularPontuacaoEdital(base);
    expect(r.motivos.some(m => m.startsWith('Whitelist TI'))).toBe(true);
  });
});
