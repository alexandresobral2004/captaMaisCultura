CREATE TABLE `analise_criterios` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`analise_id` integer NOT NULL,
	`criterio` text NOT NULL,
	`ordem` integer DEFAULT 0,
	FOREIGN KEY (`analise_id`) REFERENCES `analise_ia`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `analise_documentos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`analise_id` integer NOT NULL,
	`documento` text NOT NULL,
	`ordem` integer DEFAULT 0,
	FOREIGN KEY (`analise_id`) REFERENCES `analise_ia`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `analise_ia` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`edital_id` text NOT NULL,
	`resumo` text,
	`objetivo` text,
	`elegibilidade` text,
	`contato_edital` text,
	`score_adequacao` integer,
	`criado_em` text DEFAULT 'CURRENT_TIMESTAMP',
	`atualizado_em` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`edital_id`) REFERENCES `editais`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `analise_ia_edital_id_unique` ON `analise_ia` (`edital_id`);--> statement-breakpoint
CREATE TABLE `analise_itens_financiaveis` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`analise_id` integer NOT NULL,
	`item` text NOT NULL,
	`ordem` integer DEFAULT 0,
	FOREIGN KEY (`analise_id`) REFERENCES `analise_ia`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `analise_pontos_fracos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`analise_id` integer NOT NULL,
	`ponto_fraco` text NOT NULL,
	`ordem` integer DEFAULT 0,
	FOREIGN KEY (`analise_id`) REFERENCES `analise_ia`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `analise_requisitos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`analise_id` integer NOT NULL,
	`requisito` text NOT NULL,
	`ordem` integer DEFAULT 0,
	FOREIGN KEY (`analise_id`) REFERENCES `analise_ia`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `areas_tematicas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nome` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `areas_tematicas_nome_unique` ON `areas_tematicas` (`nome`);--> statement-breakpoint
CREATE TABLE `arquivos_anexos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`edital_id` text NOT NULL,
	`descricao` text,
	`url` text,
	`tipo` text,
	`caminho_local` text,
	`tamanho_bytes` integer,
	`hash_arquivo` text,
	`criado_em` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`edital_id`) REFERENCES `editais`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `editais` (
	`id` text PRIMARY KEY NOT NULL,
	`titulo` text NOT NULL,
	`orgao` text NOT NULL,
	`valor` text,
	`valor_min` real,
	`valor_max` real,
	`data_publicacao` text,
	`data_abertura` text,
	`data_limite` text NOT NULL,
	`data_resultado` text,
	`status` text DEFAULT 'Aberto' NOT NULL,
	`status_analise` text DEFAULT 'pendente',
	`erro_analise` text,
	`modalidade` text,
	`abrangencia` text,
	`tipo_proponente` text,
	`areas_tematicas` text,
	`tipo_edital` text,
	`descricao` text,
	`link` text NOT NULL,
	`pdf_url` text,
	`pdf_path` text,
	`conteudo_completo` text,
	`fonte_conteudo` text,
	`arquivos_anexos` text,
	`tecnologia_foco` text,
	`tipo_ferramenta` text,
	`score_relevancia` integer,
	`score_confianca_ia` integer,
	`validado_por_ia` integer DEFAULT false,
	`motivo_rejeicao` text,
	`fora_do_escopo` integer DEFAULT false,
	`data_validacao_ia` text,
	`score_pontuacao` integer,
	`nivel_pontuacao` text,
	`motivos_pontuacao` text,
	`modo_analise_ia` text,
	`hash_pontuacao` text,
	`cache_classificacao_usado` integer DEFAULT false,
	`confianca_por_campo` text,
	`criado_em` text DEFAULT 'CURRENT_TIMESTAMP',
	`atualizado_em` text DEFAULT 'CURRENT_TIMESTAMP',
	`deleted_at` text,
	`codigo` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `editais_codigo_unique` ON `editais` (`codigo`);--> statement-breakpoint
CREATE INDEX `idx_editais_status` ON `editais` (`status`);--> statement-breakpoint
CREATE INDEX `idx_editais_data_limite` ON `editais` (`data_limite`);--> statement-breakpoint
CREATE INDEX `idx_editais_orgao` ON `editais` (`orgao`);--> statement-breakpoint
CREATE INDEX `idx_editais_score` ON `editais` (`score_relevancia`);--> statement-breakpoint
CREATE INDEX `idx_editais_tecnologia` ON `editais` (`tecnologia_foco`);--> statement-breakpoint
CREATE INDEX `idx_editais_criado_em` ON `editais` (`criado_em`);--> statement-breakpoint
CREATE INDEX `idx_editais_deleted_at` ON `editais` (`deleted_at`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'PENDENTE' NOT NULL,
	`fase` text,
	`total_encontrados` integer DEFAULT 0,
	`total_validados` integer DEFAULT 0,
	`total_downloads` integer DEFAULT 0,
	`total_analisados` integer DEFAULT 0,
	`total_erros` integer DEFAULT 0,
	`erro_detalhes` text,
	`iniciado_em` text NOT NULL,
	`finalizado_em` text,
	`atualizado_em` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_jobs_status` ON `jobs` (`status`);--> statement-breakpoint
CREATE INDEX `idx_jobs_iniciado_em` ON `jobs` (`iniciado_em`);--> statement-breakpoint
CREATE TABLE `logs_sistema` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nivel` text NOT NULL,
	`mensagem` text NOT NULL,
	`cenario_falha` text,
	`acao_tomada` text,
	`repeticoes` integer DEFAULT 0,
	`contexto` text,
	`caminho` text,
	`detalhes` text,
	`usuario_id` text,
	`ip` text,
	`user_agent` text,
	`criado_em` text DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE INDEX `idx_logs_nivel` ON `logs_sistema` (`nivel`);--> statement-breakpoint
CREATE INDEX `idx_logs_criado_em` ON `logs_sistema` (`criado_em`);--> statement-breakpoint
CREATE INDEX `idx_logs_contexto` ON `logs_sistema` (`contexto`);--> statement-breakpoint
CREATE INDEX `idx_logs_cenario` ON `logs_sistema` (`cenario_falha`);--> statement-breakpoint
CREATE INDEX `idx_logs_acao` ON `logs_sistema` (`acao_tomada`);--> statement-breakpoint
CREATE TABLE `motivos_pontuacao` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`edital_id` text NOT NULL,
	`motivo` text NOT NULL,
	`fonte` text DEFAULT 'whitelist' NOT NULL,
	`score_parcial` integer,
	`score_final` integer,
	`detalhes` text,
	`criado_em` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`edital_id`) REFERENCES `editais`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_motivos_edital_fonte` ON `motivos_pontuacao` (`edital_id`,`fonte`);--> statement-breakpoint
CREATE INDEX `idx_motivos_fonte` ON `motivos_pontuacao` (`fonte`);--> statement-breakpoint
CREATE TABLE `palavras_chave` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`edital_id` text NOT NULL,
	`palavra` text NOT NULL,
	`frequencia` integer DEFAULT 1,
	FOREIGN KEY (`edital_id`) REFERENCES `editais`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `portais` (
	`id` text PRIMARY KEY NOT NULL,
	`nome` text NOT NULL,
	`url_busca` text NOT NULL,
	`urls_fallback` text,
	`tipo` text NOT NULL,
	`categoria` text NOT NULL,
	`ativo` integer DEFAULT true,
	`scraper_module` text,
	`intervalo_minutos` integer DEFAULT 60,
	`ultimo_scan` text,
	`cred_email` text,
	`criado_em` text NOT NULL,
	`atualizado_em` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_portais_ativo` ON `portais` (`ativo`);--> statement-breakpoint
CREATE INDEX `idx_portais_categoria` ON `portais` (`categoria`);--> statement-breakpoint
CREATE TABLE `projetos` (
	`id` text PRIMARY KEY NOT NULL,
	`edital_id` text NOT NULL,
	`titulo` text NOT NULL,
	`descricao` text,
	`area_atuacao` text,
	`proposta_usuario` text,
	`resumo_executivo` text,
	`justificativa` text,
	`objetivos` text,
	`metodologia` text,
	`resultados_esperados` text,
	`cronograma` text,
	`orcamento_detalhado` text,
	`valor_solicitado` real,
	`prazo_meses` integer,
	`equipe` text,
	`criterios_atendidos` text,
	`criterios_pendentes` text,
	`score_compliance` integer,
	`status` text DEFAULT 'rascunho',
	`versao` integer DEFAULT 1,
	`prompt_original` text,
	`fontes` text,
	`secoes_dinamicas` text,
	`criado_em` text DEFAULT 'CURRENT_TIMESTAMP',
	`atualizado_em` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`edital_id`) REFERENCES `editais`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_projetos_edital_id` ON `projetos` (`edital_id`);--> statement-breakpoint
CREATE INDEX `idx_projetos_status` ON `projetos` (`status`);--> statement-breakpoint
CREATE INDEX `idx_projetos_criado_em` ON `projetos` (`criado_em`);--> statement-breakpoint
CREATE TABLE `rag_chunks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`documento_nome` text NOT NULL,
	`documento_tipo` text NOT NULL,
	`titulo` text NOT NULL,
	`conteudo` text NOT NULL,
	`pagina_inicio` integer,
	`pagina_fim` integer,
	`tags` text,
	`categoria` text,
	`embedding` text,
	`hash_conteudo` text NOT NULL,
	`criado_em` text DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE INDEX `idx_rag_documento` ON `rag_chunks` (`documento_nome`);--> statement-breakpoint
CREATE INDEX `idx_rag_categoria` ON `rag_chunks` (`categoria`);--> statement-breakpoint
CREATE INDEX `idx_rag_hash` ON `rag_chunks` (`hash_conteudo`);--> statement-breakpoint
CREATE TABLE `tipos_proponente` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nome` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tipos_proponente_nome_unique` ON `tipos_proponente` (`nome`);--> statement-breakpoint
CREATE TABLE `usuarios` (
	`id` text PRIMARY KEY NOT NULL,
	`nome` text NOT NULL,
	`email` text NOT NULL,
	`password` text NOT NULL,
	`role` text DEFAULT 'leitor' NOT NULL,
	`status` text DEFAULT 'ativo' NOT NULL,
	`criado_em` text DEFAULT 'CURRENT_TIMESTAMP',
	`atualizado_em` text DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `usuarios_email_unique` ON `usuarios` (`email`);