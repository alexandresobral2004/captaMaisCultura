import { z } from 'zod';

// Schema para criar edital
export const CreateEditalSchema = z.object({
  id: z.string().min(1, 'ID e obrigatorio'),
  titulo: z.string().min(1, 'Titulo e obrigatorio'),
  orgao: z.string().min(1, 'Orgao e obrigatorio'),
  valor: z.string().optional(),
  valorMin: z.number().optional(),
  valorMax: z.number().optional(),
  dataPublicacao: z.string().optional(),
  dataLimite: z.string().min(1, 'Data limite e obrigatoria'),
  dataResultado: z.string().optional(),
  status: z.enum(['Aberto', 'Prorrogado', 'Em Analise', 'Fechado']).optional(),
  statusAnalise: z.enum(['pendente', 'pdf_baixado', 'analisado', 'sem_pdf', 'descartado', 'erro']).optional(),
  modalidade: z.string().optional(),
  abrangencia: z.string().optional(),
  tipoProponente: z.array(z.string()).optional(),
  areasTematicas: z.array(z.string()).optional(),
  tipoEdital: z.enum(['chamada_publica', 'evento_cientifico', 'outro']).optional(),
  descricao: z.string().optional(),
  link: z.string().min(1, 'Link e obrigatorio'),
  pdfUrl: z.string().optional(),
  pdfPath: z.string().optional(),
  conteudoCompleto: z.string().optional(),
  fonteConteudo: z.enum(['pdf_s3', 'pdf_link', 'html_link', 'descricao_api', 'mock', 'sem_pdf', 'pdf_upload']).optional(),
  arquivosAnexos: z.array(z.any()).optional(),
  tecnologiaFoco: z.string().optional(),
  tipoFerramenta: z.string().optional(),
  scoreRelevancia: z.number().min(0).max(100).optional(),
  scoreConfiancaIa: z.number().min(0).max(100).optional(),
  validadoPorIa: z.boolean().optional(),
  motivoRejeicao: z.string().optional(),
  foraDoEscopo: z.boolean().optional(),
  dataValidacaoIa: z.string().optional(),
  scorePontuacao: z.number().min(0).max(100).optional(),
  nivelPontuacao: z.enum(['baixo', 'medio', 'alto']).optional(),
  motivosPontuacao: z.array(z.string()).optional(),
  modoAnaliseIa: z.enum(['ignorar', 'simplificado', 'completo']).optional(),
  hashPontuacao: z.string().optional(),
  cacheClassificacaoUsado: z.boolean().optional(),
  categoriaArea: z.string().optional(),
});

// Schema para atualizar edital
export const UpdateEditalSchema = CreateEditalSchema.partial().omit({ id: true });

// Schema para query de listagem
export const ListEditaisQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  statusAnalise: z.string().optional(),
  orgao: z.string().optional(),
  tecnologia: z.string().optional(),
  scoreMin: z.coerce.number().min(0).max(100).optional(),
  scoreMax: z.coerce.number().min(0).max(100).optional(),
  dataInicio: z.string().optional(),
  dataFim: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  categoriaArea: z.string().optional(),
});

// Schema para busca
export const SearchQuerySchema = z.object({
  search: z.string().min(1, 'Termo de busca e obrigatorio'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  orgao: z.string().optional(),
  tecnologia: z.string().optional(),
  scoreMin: z.coerce.number().min(0).max(100).optional(),
  categoriaArea: z.string().optional(),
});

// Schema para analise IA
export const AnaliseIASchema = z.object({
  editalId: z.string().min(1, 'ID do edital e obrigatorio'),
  resumo: z.string().optional(),
  objetivo: z.string().optional(),
  elegibilidade: z.string().optional(),
  contatoEdital: z.string().optional(),
  scoreAdequacao: z.number().min(0).max(100).optional(),
  requisitos: z.array(z.string()).optional(),
  itensFinanciaveis: z.array(z.string()).optional(),
  documentos: z.array(z.string()).optional(),
  criterios: z.array(z.string()).optional(),
  pontosFracos: z.array(z.string()).optional(),
});

// Schema para Cadastro de Usuários
export const CadastroUsuarioSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(100, 'Nome muito longo'),
  email: z.string().email('Email inválido'),
  password: z
    .string()
    .min(8, 'Senha deve ter no mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Senha deve conter pelo menos uma letra maiúscula')
    .regex(/[a-z]/, 'Senha deve conter pelo menos uma letra minúscula')
    .regex(/[0-9]/, 'Senha deve conter pelo menos um número')
    .regex(/[^A-Za-z0-9]/, 'Senha deve conter pelo menos um caractere especial'),
  confirmarPassword: z.string(),
}).refine((data) => data.password === data.confirmarPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmarPassword'],
});

// Schema para Login de Usuários
export const LoginUsuarioSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

// Funcao para validar query params
export function validateQuery<T>(schema: z.ZodSchema<T>, searchParams: URLSearchParams): T {
  const params: Record<string, any> = {};
  searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return schema.parse(params);
}

// Funcao para validar body
export function validateBody<T>(schema: z.ZodSchema<T>, body: any): T {
  return schema.parse(body);
}
