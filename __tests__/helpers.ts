import { CreateEditalDTO } from '../lib/database/repositories/edital.repository';
import { CreateAnaliseDTO } from '../lib/database/repositories/analise.repository';

let counter = 0;

export function resetCounter() {
  counter = 0;
}

export function uniqueId(prefix = 'edital') {
  counter++;
  return `${prefix}-test-${counter}-${Date.now()}`;
}

export function makeEditalDTO(overrides: Partial<CreateEditalDTO> = {}): CreateEditalDTO {
  return {
    id: uniqueId(),
    titulo: 'Edital de Teste',
    orgao: 'CNPq',
    dataLimite: '2026-12-31',
    link: 'https://example.com/edital/1',
    ...overrides,
  };
}

export function makeAnaliseDTO(overrides: Partial<CreateAnaliseDTO> = {}): CreateAnaliseDTO {
  return {
    editalId: uniqueId('analise'),
    resumo: 'Resumo da analise de teste',
    objetivo: 'Objetivo do edital',
    elegibilidade: 'Elegibilidade do edital',
    contatoEdital: 'contato@cnpq.br',
    scoreAdequacao: 85,
    requisitos: ['Requisito 1', 'Requisito 2'],
    itensFinanciaveis: ['Item 1', 'Item 2', 'Item 3'],
    documentos: ['Documento A', 'Documento B'],
    criterios: ['Criterio X'],
    pontosFracos: ['Ponto fraco 1'],
    ...overrides,
  };
}

export const EDITAL_MINIMAL: Partial<CreateEditalDTO> = {
  titulo: 'Edital Minimal',
  orgao: 'FAPERJ',
  dataLimite: '2026-06-30',
  link: 'https://example.com/minimal',
};

export const EDITAL_FULL: Partial<CreateEditalDTO> = {
  titulo: 'Edital Full',
  orgao: 'CNPq',
  valor: 'R$ 100.000,00',
  valorMin: 10000,
  valorMax: 100000,
  dataPublicacao: '2026-01-01',
  dataLimite: '2026-12-31',
  dataResultado: '2027-03-01',
  status: 'Aberto',
  statusAnalise: 'analisado',
  modalidade: 'Chamada Publica',
  abrangencia: 'Nacional',
  tipoProponente: ['Universidade', 'Instituto de Pesquisa'],
  areasTematicas: ['Tecnologia', 'Saude'],
  tipoEdital: 'chamada_publica',
  descricao: 'Descricao completa do edital de teste',
  link: 'https://example.com/full',
  pdfUrl: 'https://example.com/full.pdf',
  pdfPath: 'downloads/edital-full.pdf',
  conteudoCompleto: 'Conteudo completo do edital...',
  fonteConteudo: 'pdf_link',
  arquivosAnexos: [{ descricao: 'Anexo 1', url: 'https://example.com/anexo1.pdf' }],
  tecnologiaFoco: 'React, TypeScript, Node.js',
  tipoFerramenta: 'Frontend',
  scoreRelevancia: 90,
  scoreConfiancaIa: 85,
  validadoPorIa: true,
  motivoRejeicao: undefined,
  foraDoEscopo: false,
  dataValidacaoIa: '2026-06-01',
  scorePontuacao: 80,
  nivelPontuacao: 'alto',
  motivosPontuacao: ['Relevante para TI', 'Bem estruturado'],
  modoAnaliseIa: 'completo',
  hashPontuacao: 'abc123hash',
  cacheClassificacaoUsado: false,
};
