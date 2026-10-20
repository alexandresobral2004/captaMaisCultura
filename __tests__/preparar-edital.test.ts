import { describe, it, expect, vi } from 'vitest';

vi.mock('../lib/scraper/pdf-downloader', () => ({
  baixarELerPDFEdital: vi.fn(async () => ({
    fonte: 'pdf_link',
    texto: 'EDITAL Nº 1/2026. Do objeto. Inscrições. Prazo.',
    caminhoArquivo: '/caminho/que/nao/existe.pdf',
    pdfUrlEncontrada: 'https://x.gov.br/edital.pdf',
  })),
}));
vi.mock('../lib/scraper/validacao-documento', () => ({
  validarDocumentoEdital: vi.fn(async () => ({ decisao: 'valido', etapa: 'jev', motivo: 'Jev confirmou que é edital (95%)', termos: [], grupos: [] })),
}));
vi.mock('../lib/ai/scoring', () => ({
  calcularPontuacaoEdital: vi.fn(async () => ({ scoreFinal: 70, motivos: ['[PDF] ok'], whitelist: { válido: false }, modoAnalise: 'completo' })),
}));
vi.mock('../lib/scraper/funil', () => ({ registrarDecisao: vi.fn() }));

import { prepararEdital } from '../lib/scraper/preparar-edital';
import type { Edital } from '../lib/db/editais-store';

const base = {
  id: 'e1', titulo: 'Chamada de apoio', orgao: 'CNPq', valor: 'A consultar', dataLimite: '2026-12-31',
  status: 'Aberto', link: 'https://x.gov.br/chamada', descricao: '', criadoEm: '2026-10-19T00:00:00.000Z',
} as unknown as Edital;

describe('prepararEdital', () => {
  it('edital sem dúvida segue para análise como pendente', async () => {
    const r = await prepararEdital({ ...base });
    expect(r.campos.statusAnalise).toBe('pendente');
    expect(r.pdfEncontrado).toBe(true);
  });

  it('mantém a dúvida da triagem mesmo quando o documento é confirmado', async () => {
    const r = await prepararEdital({
      ...base,
      statusAnalise: 'duvida',
      motivosPontuacao: ['Classificação com baixa certeza: Jev: possivelmente fora do escopo (80%)'],
    } as Edital);
    expect(r.campos.statusAnalise).toBe('duvida');
    expect(r.campos.motivosPontuacao).toContain('Classificação com baixa certeza: Jev: possivelmente fora do escopo (80%)');
    // não vai para a análise automática por IA antes da revisão humana
    expect(r.pdfEncontrado).toBe(false);
    expect(r.texto).not.toBe('');
  });
});
