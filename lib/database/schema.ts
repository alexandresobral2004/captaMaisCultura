import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// ============================================================
// TABELA PRINCIPAL - EDITAIS
// ============================================================
export const editais = sqliteTable('editais', {
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
  status: text('status', {
    enum: ['Aberto', 'Prorrogado', 'Em Analise', 'Fechado']
  }).notNull().default('Aberto'),
  statusAnalise: text('status_analise', {
    enum: ['pendente', 'pdf_baixado', 'analisado', 'sem_pdf', 'descartado', 'erro', 'duvida']
  }).default('pendente'),
  erroAnalise: text('erro_analise'),
  modalidade: text('modalidade'),
  abrangencia: text('abrangencia'),

  // Classificacao
  tipoProponente: text('tipo_proponente'), // JSON array serializado
  areasTematicas: text('areas_tematicas'), // JSON array serializado
  tipoEdital: text('tipo_edital', {
    enum: ['chamada_publica', 'evento_cientifico', 'outro']
  }),

  // Conteudo
  descricao: text('descricao'),
  link: text('link').notNull(),
  pdfUrl: text('pdf_url'),
  pdfPath: text('pdf_path'), // Caminho relativo do PDF local
  conteudoCompleto: text('conteudo_completo'),
  fonteConteudo: text('fonte_conteudo', {
    enum: ['pdf_s3', 'pdf_link', 'html_link', 'descricao_api', 'mock', 'sem_pdf', 'pdf_upload']
  }),

  // Anexo JSON serializado (arquivos do S3)
  arquivosAnexos: text('arquivos_anexos'), // JSON array serializado

  // Analise TI
  tecnologiaFoco: text('tecnologia_foco'),
  tipoFerramenta: text('tipo_ferramenta'),
  scoreRelevancia: integer('score_relevancia'),
  scoreConfiancaIa: integer('score_confianca_ia'),
  validadoPorIa: integer('validado_por_ia', { mode: 'boolean' }).default(false),
  motivoRejeicao: text('motivo_rejeicao'),
  foraDoEscopo: integer('fora_do_escopo', { mode: 'boolean' }).default(false),
  dataValidacaoIa: text('data_validacao_ia'),
  scorePontuacao: integer('score_pontuacao'),
  nivelPontuacao: text('nivel_pontuacao', {
    enum: ['baixo', 'medio', 'alto']
  }),
  motivosPontuacao: text('motivos_pontuacao'), // JSON array serializado
  modoAnaliseIa: text('modo_analise_ia', {
    enum: ['ignorar', 'simplificado', 'completo']
  }),
  hashPontuacao: text('hash_pontuacao'),
  cacheClassificacaoUsado: integer('cache_classificacao_usado', { mode: 'boolean' }).default(false),
  confiancaPorCampo: text('confianca_por_campo'), // JSON object serializado

  // Timestamps
  criadoEm: text('criado_em').default('CURRENT_TIMESTAMP'),
  atualizadoEm: text('atualizado_em').default('CURRENT_TIMESTAMP'),
  deletedAt: text('deleted_at'), // NULL = ativo, timestamp = deletado (soft-delete)

  // Codigo de identificacao (EDT-001, EDT-002, etc.)
  codigo: text('codigo').unique(),
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
export const analiseIa = sqliteTable('analise_ia', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  editalId: text('edital_id').notNull().unique().references(() => editais.id, { onDelete: 'cascade' }),
  resumo: text('resumo'),
  objetivo: text('objetivo'),
  elegibilidade: text('elegibilidade'),
  contatoEdital: text('contato_edital'),
  scoreAdequacao: integer('score_adequacao'),
  criadoEm: text('criado_em').default('CURRENT_TIMESTAMP'),
  atualizadoEm: text('atualizado_em').default('CURRENT_TIMESTAMP'),
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
export const analiseRequisitos = sqliteTable('analise_requisitos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
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
export const analiseItensFinanciaveis = sqliteTable('analise_itens_financiaveis', {
  id: integer('id').primaryKey({ autoIncrement: true }),
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
export const analiseDocumentos = sqliteTable('analise_documentos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
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
export const analiseCriterios = sqliteTable('analise_criterios', {
  id: integer('id').primaryKey({ autoIncrement: true }),
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
export const analisePontosFracos = sqliteTable('analise_pontos_fracos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
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
export const palavrasChave = sqliteTable('palavras_chave', {
  id: integer('id').primaryKey({ autoIncrement: true }),
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
export const arquivosAnexos = sqliteTable('arquivos_anexos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  editalId: text('edital_id').notNull().references(() => editais.id, { onDelete: 'cascade' }),
  descricao: text('descricao'),
  url: text('url'),
  tipo: text('tipo'),
  caminhoLocal: text('caminho_local'),
  tamanhoBytes: integer('tamanho_bytes'),
  hashArquivo: text('hash_arquivo'),
  criadoEm: text('criado_em').default('CURRENT_TIMESTAMP'),
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
export const motivosPontuacao = sqliteTable('motivos_pontuacao', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  editalId: text('edital_id').notNull().references(() => editais.id, { onDelete: 'cascade' }),
  motivo: text('motivo').notNull(),
  // Fonte da decisão — de onde veio este motivo
  fonte: text('fonte', {
    enum: ['whitelist', 'blacklist', 'ia', 'fallback', 'decisao']
  }).notNull().default('whitelist'),
  // Pontuação parcial atribuída especificamente por este motivo (positivo ou negativo)
  scoreParcial: integer('score_parcial'),
  // Score total acumulado do edital no momento em que este motivo foi registrado
  scoreFinal: integer('score_final'),
  // JSON com dados contextuais extras (termos encontrados, categoria, tipo de erro, etc.)
  detalhes: text('detalhes'),
  criadoEm: text('criado_em').default('CURRENT_TIMESTAMP'),
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
export const usuarios = sqliteTable('usuarios', {
  id: text('id').primaryKey(),
  nome: text('nome').notNull(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  role: text('role', { enum: ['admin', 'editor', 'leitor'] }).notNull().default('leitor'),
  status: text('status', { enum: ['ativo', 'inativo'] }).notNull().default('ativo'),
  criadoEm: text('criado_em').default('CURRENT_TIMESTAMP'),
  atualizadoEm: text('atualizado_em').default('CURRENT_TIMESTAMP'),
});

// ============================================================
// TABELA PROJETOS
// ============================================================
export const projetos = sqliteTable('projetos', {
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
  status: text('status', {
    enum: ['rascunho', 'em_geracao', 'revisando', 'finalizado']
  }).default('rascunho'),
  versao: integer('versao').default(1),
  promptOriginal: text('prompt_original'),

  // Fontes utilizadas na geracao
  fontes: text('fontes'), // JSON array de referencias

  // Timestamps
  criadoEm: text('criado_em').default('CURRENT_TIMESTAMP'),
  atualizadoEm: text('atualizado_em').default('CURRENT_TIMESTAMP'),
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
export const areasTematicas = sqliteTable('areas_tematicas', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nome: text('nome').notNull().unique(),
});

// ============================================================
// TABELA TIPOS DE PROPONENTE
// ============================================================
export const tiposProponente = sqliteTable('tipos_proponente', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nome: text('nome').notNull().unique(),
});

// ============================================================
// TABELA LOGS DO SISTEMA
// ============================================================
export const logsSistema = sqliteTable('logs_sistema', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nivel: text('nivel', { enum: ['error', 'warning', 'info'] }).notNull(),
  mensagem: text('mensagem').notNull(),

  // Cenario de falha - etapa do pipeline
  cenarioFalha: text('cenario_falha'),  // ex: 'autenticacao_prosas', 'download_pdf', 'analise_ia'

  // Acao tomada como resposta ao erro
  acaoTomada: text('acao_tomada', {
    enum: ['retry', 'mark_error', 'human_review', 'skip', 'fallback', 'ignore']
  }),  // retry=repetir, mark_error=marcar como erro, human_review=pedir revisao, skip=pular, fallback=usar alternativa, ignore=ignorar

  // Contagem de tentativas
  repeticoes: integer('repeticoes').default(0),

  // Informacoes de origem
  contexto: text('contexto'),      // modulo de origem (scraper, ai, api, etc)
  caminho: text('caminho'),        // arquivo/URL de origem
  detalhes: text('detalhes'),      // JSON com informacoes adicionais

  // Info do usuario/cliente
  usuarioId: text('usuario_id'),
  ip: text('ip'),
  userAgent: text('user_agent'),

  // Timestamp
  criadoEm: text('criado_em').default('CURRENT_TIMESTAMP'),
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
export const jobs = sqliteTable('jobs', {
  id: text('id').primaryKey(),
  status: text('status', {
    enum: ['PENDENTE', 'RODANDO', 'CONCLUIDO', 'ERRO']
  }).notNull().default('PENDENTE'),
  fase: text('fase', {
    enum: ['BUSCA', 'DOWNLOAD', 'ANALISE', 'NOTIFICACAO']
  }),
  // Contadores de progresso por fase
  totalEncontrados:  integer('total_encontrados').default(0),
  totalValidados:    integer('total_validados').default(0),
  totalDownloads:    integer('total_downloads').default(0),
  totalAnalisados:   integer('total_analisados').default(0),
  totalErros:        integer('total_erros').default(0),
  // Detalhes de erro parcial (JSON stringificado)
  erroDetalhes:      text('erro_detalhes'),
  // Timestamps ISO 8601
  iniciadoEm:        text('iniciado_em').notNull(),
  finalizadoEm:      text('finalizado_em'),
  atualizadoEm:      text('atualizado_em').notNull(),
}, (table) => {
    return {
      statusIdx: index('idx_jobs_status').on(table.status),
      iniciadoEmIdx: index('idx_jobs_iniciado_em').on(table.iniciadoEm),
    };
  });

// ============================================================
// TABELA PORTAIS (Configuração de fontes de editais)
// ============================================================
export const portais = sqliteTable('portais', {
  id: text('id').primaryKey(),                    // ex: "finep", "cnpq", "capes"
  nome: text('nome').notNull(),                   // ex: "FINEP - Chamadas Públicas"
  urlBusca: text('url_busca').notNull(),          // URL principal
  urlsFallback: text('urls_fallback'),            // JSON array de URLs alternativas
  tipo: text('tipo', {
    enum: ['rss', 'html', 'api', 'session']
  }).notNull(),                                   // Tipo de scraper
  categoria: text('categoria').notNull(),         // ex: "Inovação e Tecnologia"
  ativo: integer('ativo', { mode: 'boolean' }).default(true),  // Ativo/inativo
  scraperModule: text('scraper_module'),          // ex: "finep", "cnpq", "capes", "prosas"
  intervaloMinutos: integer('intervalo_minutos').default(60),
  ultimoScan: text('ultimo_scan'),                // ISO timestamp
  // Credenciais (opcional, para portais que precisam auth)
  credEmail: text('cred_email'),                  // Email para auth (opcional)
  // Timestamps
  criadoEm: text('criado_em').notNull(),
  atualizadoEm: text('atualizado_em').notNull(),
}, (table) => {
  return {
    ativoIdx: index('idx_portais_ativo').on(table.ativo),
    categoriaIdx: index('idx_portais_categoria').on(table.categoria),
  };
});
