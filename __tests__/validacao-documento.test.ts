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
  it('descarta pela regra, sem chamar o Jev', async () => {
    let chamou = false;
    const r = await validarDocumentoEdital({ ...doc, texto: 'Política de privacidade do portal.' }, async () => { chamou = true; return 1; });
    expect(r.decisao).toBe('descartado');
    expect(r.etapa).toBe('regra');
    expect(chamou).toBe(false);
  });
  it('envia palavras e trechos ao Jev e aceita com alta probabilidade', async () => {
    let entrada: any;
    const r = await validarDocumentoEdital(doc, async e => { entrada = e; return 0.93; });
    expect(r.decisao).toBe('valido');
    expect(r.etapa).toBe('jev');
    expect(entrada.termos.length).toBeGreaterThanOrEqual(3);
    expect(entrada.trechos.length).toBeGreaterThan(0);
  });
  it('descarta só com alta certeza de que não é edital', async () => {
    expect((await validarDocumentoEdital(doc, async () => 0.1)).decisao).toBe('descartado');
  });
  it('probabilidade intermediária vai para revisão', async () => {
    expect((await validarDocumentoEdital(doc, async () => 0.5)).decisao).toBe('duvida');
  });
  it('sem Jev, muitos grupos aceita e poucos vão para revisão', async () => {
    expect((await validarDocumentoEdital(doc, null)).decisao).toBe('valido');
    expect((await validarDocumentoEdital(doc, async () => { throw new Error('x'); })).decisao).toBe('valido');
    const poucos = { ...doc, texto: 'Edital de seleção. Inscrições abertas.' };
    expect((await validarDocumentoEdital(poucos, null)).decisao).toBe('duvida');
  });
});

describe('itens de menu de portais (CNPq)', () => {
  it.each([
    'Governança', 'Corregedoria', 'Dados Abertos', 'Servidores', 'Informações Classificadas',
    'Perguntas Frequentes', 'Biografia dos Dirigentes', 'Receitas e Despesas', 'Compartilhe por WhatsApp',
    'Buscar serviços por', 'Consultar minhas solicitações', 'Serviços para Imigrantes', 'Central de Atendimento',
  ])('descarta "%s"', (titulo) => {
    expect(tituloInstitucional(titulo)).toBe(true);
  });
  it('mantém chamadas reais', () => {
    expect(tituloInstitucional('Chamada CNPq/MCTI Nº 10/2026 - Universal')).toBe(false);
    expect(tituloInstitucional('Programa Mulheres e Ciência 2026')).toBe(false);
  });
});

describe('tituloInstitucional: não descarta chamadas por palavra comum', () => {
  it.each([
    'Chamada Pública sobre o fomento à música no Ceará',
    'Edital de ocupação da Galeria de Arte do Dragão do Mar',
    'Edital de Acessibilidade Cultural 2026',
    'Chamamento Público para Programas Estratégicos de Cultura',
    'Chamada Institucional de Bolsas PIBIC',
    'Chamada para Treinamentos em Inteligência Artificial',
    'Programa institucional de Doutorado sanduíche no exterior 2026',
    'Chamamento para servidores públicos pesquisadores',
  ])('mantém "%s"', t => {
    expect(tituloInstitucional(t)).toBe(false);
  });
  it.each([
    'Base Jurídica', 'Regimento Interno', 'Estatuto do CNPq', 'Carta de Serviços', 'Composição',
    'Certidão Negativa', 'Termo de Uso e Aviso de Privacidade', 'Agenda de Autoridades', 'Resultados',
    'Dúvidas Frequentes em relação ao Portal gov.br', 'Guia de Edição de Serviços do Portal Gov.br',
  ])('passa a descartar o menu "%s"', t => {
    expect(tituloInstitucional(t)).toBe(true);
  });
});
