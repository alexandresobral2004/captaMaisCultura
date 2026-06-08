import { z } from 'zod';

// Helper functions
const toString = (v: any) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) {
    return v.map(item => typeof item === 'string' ? item : JSON.stringify(item)).join('\n');
  }
  return JSON.stringify(v);
};

const toNumber = (v: any) => {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  const parsed = parseFloat(v);
  return isNaN(parsed) ? 0 : parsed;
};

// Níveis de projeto científico
export const nivelProjetoSchema = z.enum([
  'iniciacao',
  'mestrado',
  'doutorado',
  'pos-doutorado',
  'pesquisador'
]);

// Status do projeto
export const statusProjetoSchema = z.enum([
  'rascunho',
  'em_analise',
  'submetido',
  'aprovado',
  'reprovado'
]);

// Objetivo específico
const objetivoEspecificoSchema = z.object({
  cod: z.string(),
  descricao: z.string(),
  indicador: z.string(),
  meta: z.string(),
});

// Objetivos (geral e específicos)
const objetivosSchema = z.object({
  geral: z.string(),
  especificos: z.array(objetivoEspecificoSchema),
});

// Membro da equipe
const membroEquipeSchema = z.object({
  nome: z.string(),
  funcao: z.string(),
  qualificacao: z.string(),
  dedicacao: z.string(),
});

// Categoria de orçamento
const orcamentoCategoriaSchema = z.object({
  valor: z.number(),
  justificativa: z.string(),
});

// Orçamento detalhado
const orcamentoDetalhadoSchema = z.object({
  administracao: orcamentoCategoriaSchema,
  divulgacao: orcamentoCategoriaSchema,
  equipe: orcamentoCategoriaSchema,
  materiais: orcamentoCategoriaSchema,
  outros: orcamentoCategoriaSchema,
  total: z.number(),
});

// Resultado com indicador
const resultadoIndicadorSchema = z.object({
  indicador: z.string(),
  meta: z.string(),
});

// Resultado por horizonte temporal
const resultadoHorizonteSchema = z.object({
  descricao: z.string(),
  indicadores: z.array(resultadoIndicadorSchema),
});

// Resultados esperados
const resultadosEsperadosSchema = z.object({
  curtoPrazo: resultadoHorizonteSchema,
  medioPrazo: resultadoHorizonteSchema,
  longoPrazo: resultadoHorizonteSchema,
});

// Etapa do cronograma
const cronogramaEtapaSchema = z.object({
  etapa: z.string(),
  descricao: z.string(),
  duracaoMeses: z.number(),
  mesInicio: z.number(),
  mesFim: z.number(),
});

// Critério avaliado
const criterioAvaliadoSchema = z.object({
  criterio: z.string(),
  peso: z.number(),
  pontuacao: z.number(),
  atendido: z.boolean(),
  comentario: z.string(),
  sugestao: z.string().optional(),
});

// Feedback por seção
const feedbackSecaoSchema = z.object({
  secao: z.string(),
  pontuacao: z.number(),
  comentario: z.string(),
  sugestoes: z.array(z.string()),
});

// Análise de conformidade
const analiseConformidadeSchema = z.object({
  criteriosAvaliados: z.array(criterioAvaliadoSchema),
  scoreGeral: z.number(),
  feedback: z.array(feedbackSecaoSchema),
  recomendacoes: z.array(z.string()),
  dataAnalise: z.string(),
});

// Schema principal do projeto científico
export const projetoCientificoSchema = z.object({
  id: z.string(),
  titulo: z.string().min(20, 'Título deve ter no mínimo 20 caracteres').max(300, 'Título deve ter no máximo 300 caracteres'),
  areaTematica: z.string(),
  nivel: nivelProjetoSchema,
  status: statusProjetoSchema,

  // Seções do Projeto
  resumoExecutivo: z.any().optional().transform(toString).default(''),
  justificativa: z.any().optional().transform(toString).default(''),
  objetivos: z.any().optional().transform(v => {
    if (v === null || v === undefined) return JSON.stringify({ geral: '', especificos: [] });
    if (typeof v === 'string') {
      try {
        const parsed = JSON.parse(v);
        if (parsed.geral !== undefined) return JSON.stringify(parsed);
      } catch {
        return v;
      }
    }
    if (typeof v === 'object' && v.geral !== undefined) return JSON.stringify(v);
    return JSON.stringify({ geral: String(v), especificos: [] });
  }).default('{"geral":"","especificos":[]}'),
  metodologia: z.any().optional().transform(toString).default(''),
  resultadosEsperados: z.any().optional().transform(toString).default(''),
  referencias: z.any().optional().transform(toString).default(''),
  titulosPersonalizados: z.string().optional().default('{}'),
  pesquisadoresProponentes: z.string().optional().default('[]'),
  secoesDinamicas: z.string().optional().default('[]'),
  orcamento: z.any().optional().default(null),
  cronograma: z.array(cronogramaEtapaSchema).optional().default([]),
  equipe: z.array(membroEquipeSchema).optional().default([]),

  // Metadados
  editalId: z.string().optional(),
  palavrasChave: z.array(z.string()).optional().default([]),
  dataCriacao: z.string(),
  dataAtualizacao: z.string(),
  versao: z.number().default(1),

  // Análise
  analise: analiseConformidadeSchema.optional(),
  scoreCompliance: z.number().optional(),
});

// Tipos exportados
export type NivelProjeto = z.infer<typeof nivelProjetoSchema>;
export type StatusProjeto = z.infer<typeof statusProjetoSchema>;
export type ObjetivoEspecifico = z.infer<typeof objetivoEspecificoSchema>;
export type Objetivos = z.infer<typeof objetivosSchema>;
export type MembroEquipe = z.infer<typeof membroEquipeSchema>;
export type OrcamentoDetalhado = z.infer<typeof orcamentoDetalhadoSchema>;
export type CronogramaEtapa = z.infer<typeof cronogramaEtapaSchema>;
export type CriterioAvaliado = z.infer<typeof criterioAvaliadoSchema>;
export type FeedbackSecao = z.infer<typeof feedbackSecaoSchema>;
export type AnaliseConformidade = z.infer<typeof analiseConformidadeSchema>;
export type ProjetoCientifico = z.infer<typeof projetoCientificoSchema>;

// Schema para criação de projeto
export const criarProjetoCientificoSchema = z.object({
  titulo: z.string().min(20, 'Título deve ter no mínimo 20 caracteres').max(300, 'Título deve ter no máximo 300 caracteres'),
  areaTematica: z.string(),
  nivel: nivelProjetoSchema,
  editalId: z.string().optional(),
});

// Schema para atualização de projeto
export const atualizarProjetoCientificoSchema = z.object({
  titulo: z.string().min(20).max(300).optional(),
  areaTematica: z.string().optional(),
  nivel: nivelProjetoSchema.optional(),
  resumoExecutivo: z.string().optional(),
  justificativa: z.string().optional(),
  objetivos: z.any().optional(),
  metodologia: z.string().optional(),
  resultadosEsperados: z.string().optional(),
  referencias: z.string().optional(),
  titulosPersonalizados: z.string().optional(),
  pesquisadoresProponentes: z.string().optional(),
  secoesDinamicas: z.string().optional(),
  orcamento: z.any().optional(),
  cronograma: z.array(cronogramaEtapaSchema).optional(),
  equipe: z.array(membroEquipeSchema).optional(),
  palavrasChave: z.array(z.string()).optional(),
});

// Schema para análise de adequação
export const analisarAdequacaoSchema = z.object({
  projetoId: z.string(),
  editalId: z.string(),
});

// Validações de negócio
export const VALIDACOES_PROJETO = {
  titulo: { min: 20, max: 300 },
  resumo: { minPalavras: 250, maxPalavras: 500 },
  objetivosMinimos: 2,
  metodologia: { minPalavras: 300 },
};

export function validarProjeto(projeto: Partial<ProjetoCientifico>): { valido: boolean; erros: string[] } {
  const erros: string[] = [];

  if (projeto.titulo && (projeto.titulo.length < VALIDACOES_PROJETO.titulo.min || projeto.titulo.length > VALIDACOES_PROJETO.titulo.max)) {
    erros.push(`Título deve ter entre ${VALIDACOES_PROJETO.titulo.min} e ${VALIDACOES_PROJETO.titulo.max} caracteres`);
  }

  if (projeto.resumoExecutivo) {
    const palavras = projeto.resumoExecutivo.trim().split(/\s+/).length;
    if (palavras < VALIDACOES_PROJETO.resumo.minPalavras) {
      erros.push(`Resumo deve ter no mínimo ${VALIDACOES_PROJETO.resumo.minPalavras} palavras`);
    }
    if (palavras > VALIDACOES_PROJETO.resumo.maxPalavras) {
      erros.push(`Resumo deve ter no máximo ${VALIDACOES_PROJETO.resumo.maxPalavras} palavras`);
    }
  }

  if (projeto.objetivos) {
    let objetivos: any;
    try {
      objetivos = typeof projeto.objetivos === 'string' ? JSON.parse(projeto.objetivos) : projeto.objetivos;
    } catch {
      erros.push('Formato inválido nos objetivos');
    }
    if (objetivos?.especificos && objetivos.especificos.length < VALIDACOES_PROJETO.objetivosMinimos) {
      erros.push(`Deve haver pelo menos ${VALIDACOES_PROJETO.objetivosMinimos} objetivos específicos`);
    }
  }

  if (projeto.metodologia) {
    const palavras = projeto.metodologia.trim().split(/\s+/).length;
    if (palavras < VALIDACOES_PROJETO.metodologia.minPalavras) {
      erros.push(`Metodologia deve ter no mínimo ${VALIDACOES_PROJETO.metodologia.minPalavras} palavras`);
    }
  }

  return { valido: erros.length === 0, erros };
}
