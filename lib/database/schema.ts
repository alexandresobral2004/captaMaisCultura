import { pgTable, text, integer, real, boolean as pgBoolean, index, serial, customType } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

/**
 * Tipo booleano compatível com SQLite (testes) e Postgres (produção).
 * No Postgres vira BOOLEAN; no SQLite os testes usam criarTabelas() que define INTEGER,
 * e este custom type serializa true→1 e false→0 para que o binding funcione nos dois.
 */
const boolean = customType<{ data: boolean; driverData: number | boolean }>({
  dataType() { return 'boolean'; },
  toDriver(val) { return val ? 1 : 0; },
  fromDriver(val) { return Boolean(val); },
});

// ============================================================
// TABELA PRINCIPAL - EDITAIS
// ============================================================
export const editais = pgTable('editais', {
  id: text('id').primaryKey(),
  titulo: text('titulo').notNull(),
  orgao: text('orgao').notNull(),

  // Financeiro
  valor: text('valor'),
  valorMin: real('valor_min'),
  valorMax: real('valor_max'),

  // Datas
  dataPublicacao: text('data_publicacao'),
  dataAbertura: text('data_abertura'),
  dataLimite: text('data_limite').notNull(),
  dataResultado: text('data_resultado'),

  // Status
  status: text('status').notNull().default('Aberto'),
  statusAnalise: text('status_analise').default('pendente'),
  erroAnalise: text('erro_analise'),
  statusRevisao: text('status_revisao'),
  validadoManualmente: boolean('validado_manualmente'),
  dataAprovacao: text('data_aprovacao'),
  modalidade: text('modalidade'),
  abrangencia: text('abrangencia'),

  // Classificacao
  tipoProponente: text('tipo_proponente'), // JSON array serializado
  areasTematicas: text('areas_tematicas'), // JSON array serializado
  tipoEdital: text('tipo_edital'),

  // Conteudo
  descricao: text('descricao'),
  link: text('link').notNull(),
  pdfUrl: text('pdf_url'),
  pdfPath: text('pdf_path'), // Caminho relativo do PDF local
  conteudoCompleto: text('conteudo_completo'),
  fonteConteudo: text('fonte_conteudo'),

  // Anexo JSON serializado (arquivos do S3)
  arquivosAnexos: text('arquivos_anexos'), // JSON array serializado

  // Analise TI
  tecnologiaFoco: text('tecnologia_foco'),
  tipoFerramenta: text('tipo_ferramenta'),
  scoreRelevancia: integer('score_relevancia'),
  scoreConfiancaIa: integer('score_confianca_ia'),
  validadoPorIa: boolean('validado_por_ia').default(false),
  motivoRejeicao: text('motivo_rejeicao'),
  foraDoEscopo: boolean('fora_do_escopo').default(false),
  dataValidacaoIa: text('data_validacao_ia'),
  scorePontuacao: integer('score_pontuacao'),
  nivelPontuacao: text('nivel_pontuacao'),
  motivosPontuacao: text('motivos_pontuacao'), // JSON array serializado
  modoAnaliseIa: text('modo_analise_ia'),
  confiancaPorCampo: text('confianca_por_campo'), // JSON object serializado

  // Timestamps
  criadoEm: text('criado_em').default('now()'),
  atualizadoEm: text('atualizado_em').default('now()'),
  deletedAt: text('deleted_at'), // NULL = ativo, timestamp = deletado (soft-delete)
  bloqueado: boolean('bloqueado').notNull().default(false), // excluído como "não é edital": nunca mais baixado

  // Codigo de identificacao (EDT-001, EDT-002, etc.)
  codigo: text('codigo').unique(),
  categoriaArea: text('categoria_area').notNull().default('Cultura'),
}, (table) => {
  return {
    statusIdx: index('idx_editais_status').on(table.status),
    dataLimiteIdx: index('idx_editais_data_limite').on(table.dataLimite),
    orgaoIdx: index('idx_editais_orgao').on(table.orgao),
    scoreIdx: index('idx_editais_score').on(table.scoreRelevancia),
    tecnologiaIdx: index('idx_editais_tecnologia').on(table.tecnologiaFoco),
    criadoEmIdx: index('idx_editais_criado_em').on(table.criadoEm),
    deletedAtIdx: index('idx_editais_deleted_at').on(table.deletedAt),
  };
});

// ============================================================
// RELACIONAMENTOS
// ============================================================
export const editaisRelations = relations(editais, ({ many, one }) => ({
  analiseIa: one(analiseIa, {
    fields: [editais.id],
    references: [analiseIa.editalId],
  }),
  palavrasChave: many(palavrasChave),
  arquivosAnexos: many(arquivosAnexos),
  motivosPontuacao: many(motivosPontuacao),
}));

// ============================================================
// TABELA ANALISE IA
// ============================================================
export const analiseIa = pgTable('analise_ia', {
  id: serial('id').primaryKey(),
  editalId: text('edital_id').notNull().unique().references(() => editais.id, { onDelete: 'cascade' }),
  resumo: text('resumo'),
  objetivo: text('objetivo'),
  elegibilidade: text('elegibilidade'),
  contatoEdital: text('contato_edital'),
  scoreAdequacao: integer('score_adequacao'),
  secoesRequeridas: text('secoes_requeridas'), // JSON array serializado de strings
  criadoEm: text('criado_em').default('now()'),
  atualizadoEm: text('atualizado_em').default('now()'),
});

export const analiseIaRelations = relations(analiseIa, ({ one, many }) => ({
  edital: one(editais, {
    fields: [analiseIa.editalId],
    references: [editais.id],
  }),
  requisitos: many(analiseRequisitos),
  itensFinanciaveis: many(analiseItensFinanciaveis),
  documentos: many(analiseDocumentos),
  criterios: many(analiseCriterios),
  pontosFracos: many(analisePontosFracos),
}));

// ============================================================
// TABELA REQUISITOS DA ANALISE
// ============================================================
export const analiseRequisitos = pgTable('analise_requisitos', {
  id: serial('id').primaryKey(),
  analiseId: integer('analise_id').notNull().references(() => analiseIa.id, { onDelete: 'cascade' }),
  requisito: text('requisito').notNull(),
  ordem: integer('ordem').default(0),
});

export const analiseRequisitosRelations = relations(analiseRequisitos, ({ one }) => ({
  analise: one(analiseIa, {
    fields: [analiseRequisitos.analiseId],
    references: [analiseIa.id],
  }),
}));

// ============================================================
// TABELA ITENS FINANCIAVEIS DA ANALISE
// ============================================================
export const analiseItensFinanciaveis = pgTable('analise_itens_financiaveis', {
  id: serial('id').primaryKey(),
  analiseId: integer('analise_id').notNull().references(() => analiseIa.id, { onDelete: 'cascade' }),
  item: text('item').notNull(),
  ordem: integer('ordem').default(0),
});

export const analiseItensFinanciaveisRelations = relations(analiseItensFinanciaveis, ({ one }) => ({
  analise: one(analiseIa, {
    fields: [analiseItensFinanciaveis.analiseId],
    references: [analiseIa.id],
  }),
}));

// ============================================================
// TABELA DOCUMENTOS NECESSARIOS
// ============================================================
export const analiseDocumentos = pgTable('analise_documentos', {
  id: serial('id').primaryKey(),
  analiseId: integer('analise_id').notNull().references(() => analiseIa.id, { onDelete: 'cascade' }),
  documento: text('documento').notNull(),
  ordem: integer('ordem').default(0),
});

export const analiseDocumentosRelations = relations(analiseDocumentos, ({ one }) => ({
  analise: one(analiseIa, {
    fields: [analiseDocumentos.analiseId],
    references: [analiseIa.id],
  }),
}));

// ============================================================
// TABELA CRITERIOS DE AVALIACAO
// ============================================================
export const analiseCriterios = pgTable('analise_criterios', {
  id: serial('id').primaryKey(),
  analiseId: integer('analise_id').notNull().references(() => analiseIa.id, { onDelete: 'cascade' }),
  criterio: text('criterio').notNull(),
  ordem: integer('ordem').default(0),
});

export const analiseCriteriosRelations = relations(analiseCriterios, ({ one }) => ({
  analise: one(analiseIa, {
    fields: [analiseCriterios.analiseId],
    references: [analiseIa.id],
  }),
}));

// ============================================================
// TABELA PONTOS FRACOS
// ============================================================
export const analisePontosFracos = pgTable('analise_pontos_fracos', {
  id: serial('id').primaryKey(),
  analiseId: integer('analise_id').notNull().references(() => analiseIa.id, { onDelete: 'cascade' }),
  pontoFraco: text('ponto_fraco').notNull(),
  ordem: integer('ordem').default(0),
});

export const analisePontosFracosRelations = relations(analisePontosFracos, ({ one }) => ({
  analise: one(analiseIa, {
    fields: [analisePontosFracos.analiseId],
    references: [analiseIa.id],
  }),
}));

// ============================================================
// TABELA PALAVRAS CHAVE
// ============================================================
export const palavrasChave = pgTable('palavras_chave', {
  id: serial('id').primaryKey(),
  editalId: text('edital_id').notNull().references(() => editais.id, { onDelete: 'cascade' }),
  palavra: text('palavra').notNull(),
  frequencia: integer('frequencia').default(1),
});

export const palavrasChaveRelations = relations(palavrasChave, ({ one }) => ({
  edital: one(editais, {
    fields: [palavrasChave.editalId],
    references: [editais.id],
  }),
}));

// ============================================================
// TABELA ARQUIVOS ANEXOS
// ============================================================
export const arquivosAnexos = pgTable('arquivos_anexos', {
  id: serial('id').primaryKey(),
  editalId: text('edital_id').notNull().references(() => editais.id, { onDelete: 'cascade' }),
  descricao: text('descricao'),
  url: text('url'),
  tipo: text('tipo'),
  caminhoLocal: text('caminho_local'),
  tamanhoBytes: integer('tamanho_bytes'),
  hashArquivo: text('hash_arquivo'),
  criadoEm: text('criado_em').default('now()'),
});

export const arquivosAnexosRelations = relations(arquivosAnexos, ({ one }) => ({
  edital: one(editais, {
    fields: [arquivosAnexos.editalId],
    references: [editais.id],
  }),
}));

// ============================================================
// TABELA MOTIVOS DE PONTUACAO (expandida com auditoria de filtros)
// ============================================================
export const motivosPontuacao = pgTable('motivos_pontuacao', {
  id: serial('id').primaryKey(),
  editalId: text('edital_id').notNull().references(() => editais.id, { onDelete: 'cascade' }),
  motivo: text('motivo').notNull(),
  // Fonte da decisão — de onde veio este motivo
  fonte: text('fonte').notNull().default('whitelist'),
  // Pontuação parcial atribuída especificamente por este motivo (positivo ou negativo)
  scoreParcial: integer('score_parcial'),
  // Score total acumulado do edital no momento em que este motivo foi registrado
  scoreFinal: integer('score_final'),
  // JSON com dados contextuais extras (termos encontrados, categoria, tipo de erro, etc.)
  detalhes: text('detalhes'),
  criadoEm: text('criado_em').default('now()'),
}, (table) => ({
  editalFonteIdx: index('idx_motivos_edital_fonte').on(table.editalId, table.fonte),
  fonteIdx: index('idx_motivos_fonte').on(table.fonte),
}));

export const motivosPontuacaoRelations = relations(motivosPontuacao, ({ one }) => ({
  edital: one(editais, {
    fields: [motivosPontuacao.editalId],
    references: [editais.id],
  }),
}));

// ============================================================
// TABELA USUARIOS
// ============================================================
export const usuarios = pgTable('usuarios', {
  id: text('id').primaryKey(),
  nome: text('nome').notNull(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  role: text('role').notNull().default('leitor'),
  status: text('status').notNull().default('ativo'),
  criadoEm: text('criado_em').default('now()'),
  atualizadoEm: text('atualizado_em').default('now()'),
});

// ============================================================
// TABELA PROJETOS
// ============================================================
export const projetos = pgTable('projetos', {
  id: text('id').primaryKey(),
  editalId: text('edital_id').notNull().references(() => editais.id, { onDelete: 'cascade' }),
  titulo: text('titulo').notNull(),
  descricao: text('descricao'),
  areaAtuacao: text('area_atuacao'),

  // Campo do usuario (proposta livre)
  propostaUsuario: text('proposta_usuario'),

  // Secoes geradas pela IA
  resumoExecutivo: text('resumo_executivo'),
  justificativa: text('justificativa'),
  objetivos: text('objetivos'),
  metodologia: text('metodologia'),
  resultadosEsperados: text('resultados_esperados'),
  cronograma: text('cronograma'),
  orcamentoDetalhado: text('orcamento_detalhado'),

  // Financeiro
  valorSolicitado: real('valor_solicitado'),
  prazoMeses: integer('prazo_meses'),
  equipe: text('equipe'), // JSON array serializado

  // Compliance
  criteriosAtendidos: text('criterios_atendidos'), // JSON array
  criteriosPendentes: text('criterios_pendentes'), // JSON array
  scoreCompliance: integer('score_compliance'),

  // Status e versoes
  status: text('status').default('rascunho'),
  versao: integer('versao').default(1),
  promptOriginal: text('prompt_original'),

  // Fontes utilizadas na geracao
  fontes: text('fontes'), // JSON array de referencias

  // Seções dinâmicas da proposta
  secoesDinamicas: text('secoes_dinamicas'), // JSON serializado de SecaoDinamica[]

  // Logo e Dados do Proponente
  logoUrl: text('logo_url'), // Base64 ou URL da logo
  logoDescricao: text('logo_descricao'), // Descrição textual da logo
  dadosProponente: text('dados_proponente'), // JSON com identificação, endereço, etc.

  // Timestamps
  criadoEm: text('criado_em').default('now()'),
  atualizadoEm: text('atualizado_em').default('now()'),
}, (table) => {
  return {
    editalIdIdx: index('idx_projetos_edital_id').on(table.editalId),
    statusIdx: index('idx_projetos_status').on(table.status),
    criadoEmIdx: index('idx_projetos_criado_em').on(table.criadoEm),
  };
});

// ============================================================
// RELACIONAMENTOS PROJETOS
// ============================================================
export const projetosRelations = relations(projetos, ({ one }) => ({
  edital: one(editais, {
    fields: [projetos.editalId],
    references: [editais.id],
  }),
}));

// ============================================================
// TABELA AREAS TEMATICAS
// ============================================================
export const areasTematicas = pgTable('areas_tematicas', {
  id: serial('id').primaryKey(),
  nome: text('nome').notNull().unique(),
});

// ============================================================
// TABELA TIPOS DE PROPONENTE
// ============================================================
export const tiposProponente = pgTable('tipos_proponente', {
  id: serial('id').primaryKey(),
  nome: text('nome').notNull().unique(),
});

// ============================================================
// TABELA LOGS DO SISTEMA
// ============================================================
export const logsSistema = pgTable('logs_sistema', {
  id: serial('id').primaryKey(),
  nivel: text('nivel').notNull(),
  mensagem: text('mensagem').notNull(),

  // Cenario de falha - etapa do pipeline
  cenarioFalha: text('cenario_falha'),

  // Acao tomada como resposta ao erro
  acaoTomada: text('acao_tomada'),

  // Contagem de tentativas
  repeticoes: integer('repeticoes').default(0),

  // Informacoes de origem
  contexto: text('contexto'),
  caminho: text('caminho'),
  detalhes: text('detalhes'), // JSON com informacoes adicionais

  // Info do usuario/cliente
  usuarioId: text('usuario_id'),
  ip: text('ip'),
  userAgent: text('user_agent'),

  // Timestamp
  criadoEm: text('criado_em').default('now()'),
}, (table) => {
  return {
    nivelIdx: index('idx_logs_nivel').on(table.nivel),
    criadoEmIdx: index('idx_logs_criado_em').on(table.criadoEm),
    contextoIdx: index('idx_logs_contexto').on(table.contexto),
    cenarioIdx: index('idx_logs_cenario').on(table.cenarioFalha),
    acaoIdx: index('idx_logs_acao').on(table.acaoTomada),
  };
});

// ============================================================
// RELACIONAMENTOS LOGS
// ============================================================
export const logsSistemaRelations = relations(logsSistema, ({ one }) => ({
  usuario: one(usuarios, {
    fields: [logsSistema.usuarioId],
    references: [usuarios.id],
  }),
}));

// ============================================================
// TABELA JOBS
// ============================================================
export const jobs = pgTable('jobs', {
  id: text('id').primaryKey(),
  status: text('status').notNull().default('PENDENTE'),
  fase: text('fase'),
  // Contadores de progresso por fase
  totalEncontrados: integer('total_encontrados').default(0),
  totalValidados: integer('total_validados').default(0),
  totalDownloads: integer('total_downloads').default(0),
  totalAnalisados: integer('total_analisados').default(0),
  totalErros: integer('total_erros').default(0),
  // Detalhes de erro parcial (JSON stringificado)
  erroDetalhes: text('erro_detalhes'),
  // Timestamps ISO 8601
  iniciadoEm: text('iniciado_em').notNull(),
  finalizadoEm: text('finalizado_em'),
  atualizadoEm: text('atualizado_em').notNull(),
}, (table) => {
  return {
    statusIdx: index('idx_jobs_status').on(table.status),
    iniciadoEmIdx: index('idx_jobs_iniciado_em').on(table.iniciadoEm),
  };
});

// ============================================================
// TABELA PORTAIS (Configuração de fontes de editais)
// ============================================================
export const portais = pgTable('portais', {
  id: text('id').primaryKey(),
  nome: text('nome').notNull(),
  urlBusca: text('url_busca').notNull(),
  urlsFallback: text('urls_fallback'),
  tipo: text('tipo').notNull(),
  categoria: text('categoria').notNull(),
  eixo: text('eixo').notNull().default('auto'),
  ativo: boolean('ativo').default(true),
  scraperModule: text('scraper_module'),
  intervaloMinutos: integer('intervalo_minutos').default(60),
  ultimoScan: text('ultimo_scan'),
  credEmail: text('cred_email'),
  criadoEm: text('criado_em').notNull(),
  atualizadoEm: text('atualizado_em').notNull(),
}, (table) => {
  return {
    ativoIdx: index('idx_portais_ativo').on(table.ativo),
    categoriaIdx: index('idx_portais_categoria').on(table.categoria),
  };
});

// ============================================================
// TABELA RAG CHUNKS (Base de Conhecimento Interna)
// ============================================================
export const ragChunks = pgTable('rag_chunks', {
  id: serial('id').primaryKey(),

  // Identificação do documento fonte
  documentoNome: text('documento_nome').notNull(),
  documentoTipo: text('documento_tipo').notNull(),

  // Conteúdo do chunk
  titulo: text('titulo').notNull(),
  conteudo: text('conteudo').notNull(),
  paginaInicio: integer('pagina_inicio'),
  paginaFim: integer('pagina_fim'),

  // Metadados para retrieval
  tags: text('tags'), // JSON array de tags
  categoria: text('categoria'),

  // Embedding (Fase B)
  embedding: text('embedding'), // JSON array de floats

  // Controle
  hashConteudo: text('hash_conteudo').notNull(),
  criadoEm: text('criado_em').default('now()'),
}, (table) => ({
  docIdx: index('idx_rag_documento').on(table.documentoNome),
  catIdx: index('idx_rag_categoria').on(table.categoria),
  hashIdx: index('idx_rag_hash').on(table.hashConteudo),
}));

// ============================================================
// TABELAS DE PROMPTS DE IA
// ============================================================

export const promptsSistema = pgTable('prompts_sistema', {
  id: text('id').primaryKey(),
  modulo: text('modulo').notNull(),
  chave: text('chave').notNull(),
  conteudoPadrao: text('conteudo_padrao').notNull(),
  descricao: text('descricao'),
  criadoEm: text('criado_em').default('now()'),
}, (table) => ({
  moduloIdx: index('idx_prompts_sistema_modulo').on(table.modulo),
  chaveIdx: index('idx_prompts_sistema_chave').on(table.chave),
  moduloChaveIdx: index('idx_prompts_sistema_modulo_chave').on(table.modulo, table.chave),
}));

export const promptsCustomizados = pgTable('prompts_customizados', {
  id: text('id').primaryKey(),
  promptSistemaId: text('prompt_sistema_id').references(() => promptsSistema.id),
  conteudo: text('conteudo').notNull(),
  ativo: boolean('ativo').default(true),
  criadoPor: text('criado_por').references(() => usuarios.id),
  criadoEm: text('criado_em').default('now()'),
  atualizadoEm: text('atualizado_em').default('now()'),
}, (table) => ({
  promptSistemaIdx: index('idx_prompts_customizados_sistema_id').on(table.promptSistemaId),
  ativoIdx: index('idx_prompts_customizados_ativo').on(table.ativo),
}));

export const promptsHistorico = pgTable('prompts_historico', {
  id: text('id').primaryKey(),
  promptCustomizadoId: text('prompt_customizado_id').references(() => promptsCustomizados.id),
  conteudoAnterior: text('conteudo_anterior').notNull(),
  conteudoNovo: text('conteudo_novo').notNull(),
  alteradoPor: text('alterado_por').references(() => usuarios.id),
  alteradoEm: text('alterado_em').default('now()'),
  justificativa: text('justificativa'),
}, (table) => ({
  promptCustomizadoIdx: index('idx_prompts_historico_customizado_id').on(table.promptCustomizadoId),
  alteradoEmIdx: index('idx_prompts_historico_alterado_em').on(table.alteradoEm),
}));

// ============================================================
// RELACIONAMENTOS DOS PROMPTS
// ============================================================
export const promptsSistemaRelations = relations(promptsSistema, ({ many }) => ({
  customizacoes: many(promptsCustomizados),
}));

export const promptsCustomizadosRelations = relations(promptsCustomizados, ({ one, many }) => ({
  sistema: one(promptsSistema, {
    fields: [promptsCustomizados.promptSistemaId],
    references: [promptsSistema.id],
  }),
  criador: one(usuarios, {
    fields: [promptsCustomizados.criadoPor],
    references: [usuarios.id],
  }),
  historico: many(promptsHistorico),
}));

export const promptsHistoricoRelations = relations(promptsHistorico, ({ one }) => ({
  promptCustomizado: one(promptsCustomizados, {
    fields: [promptsHistorico.promptCustomizadoId],
    references: [promptsCustomizados.id],
  }),
  alterador: one(usuarios, {
    fields: [promptsHistorico.alteradoPor],
    references: [usuarios.id],
  }),
}));

// ============================================================
// Projetos científicos (módulo Análise Científica)
// ============================================================
export const projetosCientificos = pgTable('projetos_cientificos', {
  id: text('id').primaryKey(),
  titulo: text('titulo').notNull(),
  status: text('status').notNull().default('rascunho'),
  dados: text('dados').notNull(), // JSON do projeto completo
  criadoEm: text('criado_em').default('now()'),
  atualizadoEm: text('atualizado_em').default('now()'),
}, (table) => ({
  statusIdx: index('idx_projetos_cientificos_status').on(table.status),
}));

// ============================================================
// TABELA BUSCAS_EDITAIS (controle de frequência de buscas)
// ============================================================
export const buscasEditais = pgTable('buscas_editais', {
  id: serial('id').primaryKey(),
  iniciadaEm: text('iniciada_em').notNull(),
  concluidaEm: text('concluida_em'),
  status: text('status').notNull().default('em_andamento'),
  novos: integer('novos').default(0),
  jaExistentes: integer('ja_existentes').default(0),
  descartados: integer('descartados').default(0),
  comErro: integer('com_erro').default(0),
  mensagem: text('mensagem'),
});

// ============================================================
// TABELA FUNIL_DECISOES (decisões do funil de filtragem)
// ============================================================
export const funilDecisoes = pgTable('funil_decisoes', {
  id: serial('id').primaryKey(),
  criadaEm: text('criada_em').notNull(),
  portal: text('portal'),
  editalId: text('edital_id'),
  titulo: text('titulo').notNull(),
  etapa: text('etapa').notNull(),
  resultado: text('resultado').notNull(),
  motivo: text('motivo'),
  probabilidade: real('probabilidade'),
}, (table) => ({
  etapaIdx: index('idx_funil_decisoes_etapa').on(table.etapa, table.resultado),
}));
