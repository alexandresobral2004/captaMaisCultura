import { z } from 'zod';

const DatasSchema = z.object({
  publicacao: z.string().nullable().describe('Data de publicação em DD/MM/YYYY ou null'),
  abertura: z.string().nullable().describe('Data de abertura em DD/MM/YYYY ou null'),
  limite: z.string().nullable().describe('Data limite para inscrição em DD/MM/YYYY ou null'),
  resultado: z.string().nullable().describe('Data de resultado em DD/MM/YYYY ou null'),
  observacoes: z.string().nullable().describe('Observações sobre as datas'),
});

const ValoresSchema = z.object({
  valorMin: z.number().nullable().describe('Valor mínimo do financiamento em BRL ou null'),
  valorMax: z.number().nullable().describe('Valor máximo do financiamento em BRL ou null'),
  valorReferencia: z.string().nullable().describe('Descrição textual do valor como aparece no edital ou null'),
  moeda: z.string().nullable().describe('Moeda (BRL, USD, EUR, etc) ou null'),
  unidade: z.string().nullable().describe('Unidade (por projeto, por instituição, total, etc) ou null'),
  observacoes: z.string().nullable().describe('Observações sobre os valores'),
});

const ElegibilidadeSchema = z.object({
  tiposProponentes: z.array(z.string()).describe('Tipos de entidades que podem se inscrever'),
  requisitos: z.array(z.string()).describe('Requisitos obrigatórios para participação'),
  restricoes: z.array(z.string()).describe('Restrições do que NÃO pode participar'),
  abrangencia: z.string().describe('Abrangência geográfica: Nacional, Regional, Estadual, Municipal ou Outra'),
  areasTematicas: z.array(z.string()).describe('Áreas de foco do edital'),
  focoGeografico: z.array(z.string()).describe('Estados ou regiões específicas se aplicável'),
  observacoes: z.string().nullable().describe('Observações sobre elegibilidade'),
});

const DocumentosSchema = z.object({
  obrigatorios: z.array(z.string()).describe('Documentos que DEVEM ser enviados'),
  opcionais: z.array(z.string()).describe('Documentos que são opcionais'),
  tecnicos: z.array(z.string()).describe('Documentos técnicos do projeto'),
  fiscais: z.array(z.string()).describe('Documentos de regularidade fiscal'),
  bancarios: z.array(z.string()).describe('Documentos bancários ou financeiros'),
  totalDocumentos: z.number().nullable().describe('Total estimado de documentos ou null'),
});

const AvaliacaoSchema = z.object({
  criteriosDetalhados: z.array(z.string()).describe('Critérios detalhados de avaliação'),
  penalizacoes: z.array(z.string()).describe('Situações que resultam em reprovação'),
  pontuacaoMinima: z.number().nullable().describe('Pontuação mínima para aprovação ou null'),
});

const ConsistenciaSchema = z.object({
  status: z.enum(['ok', 'duvida', 'incompleto']).describe('Status da consistência dos dados'),
  alertas: z.array(z.string()).describe('Alertas sobre inconsistências ou dados faltantes'),
});

const ConfiancasSchema = z.object({
  datas: z.object({
    publicacao: z.number().describe('Confiança na data de publicação 0-100'),
    limite: z.number().describe('Confiança na data limite 0-100'),
    resultado: z.number().describe('Confiança na data de resultado 0-100'),
  }),
  valores: z.object({
    valorMin: z.number().describe('Confiança no valor mínimo 0-100'),
    valorMax: z.number().describe('Confiança no valor máximo 0-100'),
    valorReferencia: z.number().describe('Confiança na referência de valor 0-100'),
  }),
  tiposProponentes: z.number().describe('Confiança nos tipos de proponentes 0-100'),
  requisitos: z.number().describe('Confiança nos requisitos 0-100'),
  documentos: z.number().describe('Confiança nos documentos 0-100'),
  resumo: z.number().describe('Confiança no resumo 0-100'),
  criterios: z.number().describe('Confiança nos critérios 0-100'),
});

export const AnaliseEditalSchema = z.object({
  datas: DatasSchema.describe('Datas importantes do edital (publicação, abertura, limite, resultado)'),
  valores: ValoresSchema.describe('Informações financeiras do edital'),
  elegibilidade: ElegibilidadeSchema.describe('Informações de elegibilidade e participação'),
  documentos: DocumentosSchema.describe('Documentos necessários para submissão'),
  resumo: z.string().describe('Resumo do edital em até 5 frases'),
  objetivo: z.string().describe('Objetivo principal do edital'),
  criterios: z.array(z.string()).describe('Critérios de avaliação resumidos'),
  avaliacao: AvaliacaoSchema.describe('Detalhes da avaliação e pontuação'),
  contato: z.string().nullable().describe('Email, telefone ou canal de contato do edital'),
  consistencia: ConsistenciaSchema.describe('Verificação de consistência dos dados extraídos'),
  confiancas: ConfiancasSchema.describe('Scores de confiança (0-100) para cada grupo de campos'),
});

export type AnaliseEditalResult = z.infer<typeof AnaliseEditalSchema>;
