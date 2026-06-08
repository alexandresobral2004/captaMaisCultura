import { z } from 'zod';

const toString = (v: any) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return JSON.stringify(v);
};

const toNumber = (v: any) => {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  const parsed = parseFloat(v);
  return isNaN(parsed) ? 0 : parsed;
};

const toJsonString = (v: any) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      if (typeof parsed === 'object' && parsed !== null) {
        return JSON.stringify(parsed);
      }
      return v;
    } catch {
      return v;
    }
  }
  return JSON.stringify(v);
};

const objetivoEspecificoSchema = z.object({
  cod: z.string(),
  descricao: z.string(),
  indicador: z.string(),
  meta: z.string(),
});

const objetivosSchema = z.object({
  geral: z.string(),
  especificos: z.array(objetivoEspecificoSchema),
});

const membroEquipeSchema = z.object({
  nome: z.string(),
  funcao: z.string(),
  qualificacao: z.string(),
  dedicacao: z.string(),
});

const orcamentoCategoriaSchema = z.object({
  valor: z.number(),
  justificativa: z.string(),
});

const orcamentoDetalhadoSchema = z.object({
  administracao: orcamentoCategoriaSchema,
  divulgacao: orcamentoCategoriaSchema,
  equipe: orcamentoCategoriaSchema,
  materiais: orcamentoCategoriaSchema,
  outros: orcamentoCategoriaSchema,
  total: z.number(),
});

const resultadoIndicadorSchema = z.object({
  indicador: z.string(),
  meta: z.string(),
});

const resultadoHorizonteSchema = z.object({
  descricao: z.string(),
  indicadores: z.array(resultadoIndicadorSchema),
});

const resultadosEsperadosSchema = z.object({
  curtoPrazo: resultadoHorizonteSchema,
  medioPrazo: resultadoHorizonteSchema,
  longoPrazo: resultadoHorizonteSchema,
});

export const propostaCompletaSchema = z.object({
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
  resultadosEsperados: z.any().optional().transform(v => {
    return toJsonString(v);
  }).default(''),
  cronograma: z.any().optional().transform(toString).default(''),
  orcamentoDetalhado: z.any().optional().transform(v => {
    return toJsonString(v);
  }).default(''),
  valorSolicitado: z.any().optional().transform(toNumber).default(0),
  prazoMeses: z.any().optional().transform((v: any) => {
    if (typeof v === 'number') return v;
    const parsed = parseInt(String(v), 10);
    return isNaN(parsed) ? 12 : parsed;
  }).default(12),
  equipe: z.any().optional().transform(v => {
    if (Array.isArray(v)) return toJsonString(v);
    if (v === null || v === undefined) return JSON.stringify([]);
    if (typeof v === 'string') return v;
    return toJsonString(v);
  }).default('[]'),
  criteriosAtendidos: z.any().optional().transform(v => {
    if (Array.isArray(v)) return v;
    if (v === null || v === undefined) return [];
    return [];
  }).default([]),
  criteriosPendentes: z.any().optional().transform(v => {
    if (Array.isArray(v)) return v;
    if (v === null || v === undefined) return [];
    return [];
  }).default([]),
  scoreCompliance: z.any().optional().transform(toNumber).default(0),
  fontes: z.any().optional().transform(v => {
    if (Array.isArray(v)) return v;
    if (v === null || v === undefined) return [];
    return [];
  }).default([]),
});

export const secaoSchema = z.object({
  conteudo: z.string().describe('Conteudo da secao gerada'),
  scoreCompliance: z.number().min(0).max(100).describe('Score de compliance da secao'),
});

export type PropostaCompleta = z.infer<typeof propostaCompletaSchema>;
export type SecaoGerada = z.infer<typeof secaoSchema>;

export interface SecaoNome {
  nome: string;
  campo: keyof Pick<PropostaCompleta, 'resumoExecutivo' | 'justificativa' | 'objetivos' | 'metodologia' | 'resultadosEsperados' | 'cronograma' | 'orcamentoDetalhado'>;
}

export const propostaDinamicaSchema = z.object({
  secoes: z.record(z.string(), z.string()).describe('Mapa de chaves de seções para seus respectivos conteúdos em HTML rico/formatado'),
  valorSolicitado: z.any().optional().transform(toNumber).default(0),
  prazoMeses: z.any().optional().transform((v: any) => {
    if (typeof v === 'number') return v;
    const parsed = parseInt(String(v), 10);
    return isNaN(parsed) ? 12 : parsed;
  }).default(12),
  equipe: z.any().optional().transform(v => {
    if (Array.isArray(v)) return toJsonString(v);
    if (v === null || v === undefined) return JSON.stringify([]);
    if (typeof v === 'string') return v;
    return toJsonString(v);
  }).default('[]'),
  criteriosAtendidos: z.any().optional().transform(v => {
    if (Array.isArray(v)) return v;
    if (v === null || v === undefined) return [];
    return [];
  }).default([]),
  criteriosPendentes: z.any().optional().transform(v => {
    if (Array.isArray(v)) return v;
    if (v === null || v === undefined) return [];
    return [];
  }).default([]),
  scoreCompliance: z.any().optional().transform(toNumber).default(0),
});

export type PropostaDinamica = z.infer<typeof propostaDinamicaSchema>;