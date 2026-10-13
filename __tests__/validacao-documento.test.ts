import { describe, it, expect } from 'vitest';
import { tituloInstitucional, buscarSinaisDeEdital, validarDocumentoEdital } from '../lib/scraper/validacao-documento';

const EDITAL = `EDITAL Nº 12/2026. DO OBJETO: selecionar propostas de pesquisa. DAS INSCRIÇÕES: o prazo vai até 30/11/2026.
Podem participar proponentes vinculados a ICTs. Recursos financeiros: valor máximo de R$ 200.000,00.
Critérios de avaliação: mérito científico. Disposições finais.`;

describe('tituloInstitucional', () => {
  it.each(['Diretoria Executiva', 'Presidência', 'Categorias', 'Proteção de Dados Pessoais', 'Manual de Aplicação', 'Todas as Parcerias', 'Treinamentos'])('descarta "%s"', t => {
    expect(tituloInstitucional(t)).toBe(true);
  });
  it('mantém chamadas reais', () => {
    expect(tituloInstitucional('Chamada CNPq nº 33/2026 - Bolsas de Produtividade')).toBe(false);
    expect(tituloInstitucional('Edital 05/2026 - Seleção de projetos')).toBe(false);
  });
  it('mantém PDF mesmo com palavra de menu no nome', () => {
    expect(tituloInstitucional('Guia do candidato', 'https://x.gov.br/guia.pdf')).toBe(false);
  });
});

describe('buscarSinaisDeEdital', () => {
  it('acha vários grupos e devolve trechos', () => {
    const r = buscarSinaisDeEdital(EDITAL);
    expect(r.termos.length).toBeGreaterThanOrEqual(5);
    expect(r.trechos.length).toBe(r.termos.length);
  });
  it('texto comum quase não casa', () => {
    expect(buscarSinaisDeEdital('Nossa diretoria se reúne às terças para tratar de assuntos gerais.').termos.length).toBeLessThan(3);
  });
});

describe('validarDocumentoEdital', () => {
  const doc = { titulo: 'Edital 12/2026', orgao: 'CNPq', texto: EDITAL };
  it('rejeita pela regra, sem chamar o Jev', async () => {
    let chamou = false;
    const r = await validarDocumentoEdital({ ...doc, texto: 'Política de privacidade do portal.' }, async () => { chamou = true; return 1; });
    expect(r.valido).toBe(false);
    expect(r.etapa).toBe('regra');
    expect(chamou).toBe(false);
  });
  it('envia palavras e trechos ao Jev e aceita', async () => {
    let entrada: any;
    const r = await validarDocumentoEdital(doc, async e => { entrada = e; return 0.93; });
    expect(r.valido).toBe(true);
    expect(r.etapa).toBe('jev');
    expect(entrada.termos.length).toBeGreaterThanOrEqual(3);
    expect(entrada.trechos.length).toBeGreaterThan(0);
  });
  it('descarta quando o Jev diz que não é edital', async () => {
    const r = await validarDocumentoEdital(doc, async () => 0.12);
    expect(r.valido).toBe(false);
    expect(r.motivo).toMatch(/não é edital/);
  });
  it('mantém quando o Jev falha ou está indisponível', async () => {
    expect((await validarDocumentoEdital(doc, async () => { throw new Error('x'); })).valido).toBe(true);
    expect((await validarDocumentoEdital(doc, null)).valido).toBe(true);
  });
});
