CREATE TABLE "analise_criterios" (
	"id" serial PRIMARY KEY NOT NULL,
	"analise_id" integer NOT NULL,
	"criterio" text NOT NULL,
	"ordem" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "analise_documentos" (
	"id" serial PRIMARY KEY NOT NULL,
	"analise_id" integer NOT NULL,
	"documento" text NOT NULL,
	"ordem" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "analise_ia" (
	"id" serial PRIMARY KEY NOT NULL,
	"edital_id" text NOT NULL,
	"resumo" text,
	"objetivo" text,
	"elegibilidade" text,
	"contato_edital" text,
	"score_adequacao" integer,
	"secoes_requeridas" text,
	"criado_em" text DEFAULT 'now()',
	"atualizado_em" text DEFAULT 'now()',
	CONSTRAINT "analise_ia_edital_id_unique" UNIQUE("edital_id")
);
--> statement-breakpoint
CREATE TABLE "analise_itens_financiaveis" (
	"id" serial PRIMARY KEY NOT NULL,
	"analise_id" integer NOT NULL,
	"item" text NOT NULL,
	"ordem" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "analise_pontos_fracos" (
	"id" serial PRIMARY KEY NOT NULL,
	"analise_id" integer NOT NULL,
	"ponto_fraco" text NOT NULL,
	"ordem" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "analise_requisitos" (
	"id" serial PRIMARY KEY NOT NULL,
	"analise_id" integer NOT NULL,
	"requisito" text NOT NULL,
	"ordem" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "areas_tematicas" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	CONSTRAINT "areas_tematicas_nome_unique" UNIQUE("nome")
);
--> statement-breakpoint
CREATE TABLE "arquivos_anexos" (
	"id" serial PRIMARY KEY NOT NULL,
	"edital_id" text NOT NULL,
	"descricao" text,
	"url" text,
	"tipo" text,
	"caminho_local" text,
	"tamanho_bytes" integer,
	"hash_arquivo" text,
	"criado_em" text DEFAULT 'now()'
);
--> statement-breakpoint
CREATE TABLE "buscas_editais" (
	"id" serial PRIMARY KEY NOT NULL,
	"iniciada_em" text NOT NULL,
	"concluida_em" text,
	"status" text DEFAULT 'em_andamento' NOT NULL,
	"novos" integer DEFAULT 0,
	"ja_existentes" integer DEFAULT 0,
	"descartados" integer DEFAULT 0,
	"com_erro" integer DEFAULT 0,
	"mensagem" text
);
--> statement-breakpoint
CREATE TABLE "editais" (
	"id" text PRIMARY KEY NOT NULL,
	"titulo" text NOT NULL,
	"orgao" text NOT NULL,
	"valor" text,
	"valor_min" real,
	"valor_max" real,
	"data_publicacao" text,
	"data_abertura" text,
	"data_limite" text NOT NULL,
	"data_resultado" text,
	"status" text DEFAULT 'Aberto' NOT NULL,
	"status_analise" text DEFAULT 'pendente',
	"erro_analise" text,
	"status_revisao" text,
	"validado_manualmente" boolean,
	"data_aprovacao" text,
	"modalidade" text,
	"abrangencia" text,
	"tipo_proponente" text,
	"areas_tematicas" text,
	"tipo_edital" text,
	"descricao" text,
	"link" text NOT NULL,
	"pdf_url" text,
	"pdf_path" text,
	"conteudo_completo" text,
	"fonte_conteudo" text,
	"arquivos_anexos" text,
	"tecnologia_foco" text,
	"tipo_ferramenta" text,
	"score_relevancia" integer,
	"score_confianca_ia" integer,
	"validado_por_ia" boolean DEFAULT false,
	"motivo_rejeicao" text,
	"fora_do_escopo" boolean DEFAULT false,
	"data_validacao_ia" text,
	"score_pontuacao" integer,
	"nivel_pontuacao" text,
	"motivos_pontuacao" text,
	"modo_analise_ia" text,
	"confianca_por_campo" text,
	"criado_em" text DEFAULT 'now()',
	"atualizado_em" text DEFAULT 'now()',
	"deleted_at" text,
	"bloqueado" boolean DEFAULT false NOT NULL,
	"codigo" text,
	"categoria_area" text DEFAULT 'Cultura' NOT NULL,
	CONSTRAINT "editais_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "funil_decisoes" (
	"id" serial PRIMARY KEY NOT NULL,
	"criada_em" text NOT NULL,
	"portal" text,
	"edital_id" text,
	"titulo" text NOT NULL,
	"etapa" text NOT NULL,
	"resultado" text NOT NULL,
	"motivo" text,
	"probabilidade" real
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'PENDENTE' NOT NULL,
	"fase" text,
	"total_encontrados" integer DEFAULT 0,
	"total_validados" integer DEFAULT 0,
	"total_downloads" integer DEFAULT 0,
	"total_analisados" integer DEFAULT 0,
	"total_erros" integer DEFAULT 0,
	"erro_detalhes" text,
	"iniciado_em" text NOT NULL,
	"finalizado_em" text,
	"atualizado_em" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "logs_sistema" (
	"id" serial PRIMARY KEY NOT NULL,
	"nivel" text NOT NULL,
	"mensagem" text NOT NULL,
	"cenario_falha" text,
	"acao_tomada" text,
	"repeticoes" integer DEFAULT 0,
	"contexto" text,
	"caminho" text,
	"detalhes" text,
	"usuario_id" text,
	"ip" text,
	"user_agent" text,
	"criado_em" text DEFAULT 'now()'
);
--> statement-breakpoint
CREATE TABLE "motivos_pontuacao" (
	"id" serial PRIMARY KEY NOT NULL,
	"edital_id" text NOT NULL,
	"motivo" text NOT NULL,
	"fonte" text DEFAULT 'whitelist' NOT NULL,
	"score_parcial" integer,
	"score_final" integer,
	"detalhes" text,
	"criado_em" text DEFAULT 'now()'
);
--> statement-breakpoint
CREATE TABLE "palavras_chave" (
	"id" serial PRIMARY KEY NOT NULL,
	"edital_id" text NOT NULL,
	"palavra" text NOT NULL,
	"frequencia" integer DEFAULT 1
);
--> statement-breakpoint
CREATE TABLE "portais" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"url_busca" text NOT NULL,
	"urls_fallback" text,
	"tipo" text NOT NULL,
	"categoria" text NOT NULL,
	"eixo" text DEFAULT 'auto' NOT NULL,
	"ativo" boolean DEFAULT true,
	"scraper_module" text,
	"intervalo_minutos" integer DEFAULT 60,
	"ultimo_scan" text,
	"cred_email" text,
	"criado_em" text NOT NULL,
	"atualizado_em" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projetos" (
	"id" text PRIMARY KEY NOT NULL,
	"edital_id" text NOT NULL,
	"titulo" text NOT NULL,
	"descricao" text,
	"area_atuacao" text,
	"proposta_usuario" text,
	"resumo_executivo" text,
	"justificativa" text,
	"objetivos" text,
	"metodologia" text,
	"resultados_esperados" text,
	"cronograma" text,
	"orcamento_detalhado" text,
	"valor_solicitado" real,
	"prazo_meses" integer,
	"equipe" text,
	"criterios_atendidos" text,
	"criterios_pendentes" text,
	"score_compliance" integer,
	"status" text DEFAULT 'rascunho',
	"versao" integer DEFAULT 1,
	"prompt_original" text,
	"fontes" text,
	"secoes_dinamicas" text,
	"logo_url" text,
	"logo_descricao" text,
	"dados_proponente" text,
	"criado_em" text DEFAULT 'now()',
	"atualizado_em" text DEFAULT 'now()'
);
--> statement-breakpoint
CREATE TABLE "projetos_cientificos" (
	"id" text PRIMARY KEY NOT NULL,
	"titulo" text NOT NULL,
	"status" text DEFAULT 'rascunho' NOT NULL,
	"dados" text NOT NULL,
	"criado_em" text DEFAULT 'now()',
	"atualizado_em" text DEFAULT 'now()'
);
--> statement-breakpoint
CREATE TABLE "prompts_customizados" (
	"id" text PRIMARY KEY NOT NULL,
	"prompt_sistema_id" text,
	"conteudo" text NOT NULL,
	"ativo" boolean DEFAULT true,
	"criado_por" text,
	"criado_em" text DEFAULT 'now()',
	"atualizado_em" text DEFAULT 'now()'
);
--> statement-breakpoint
CREATE TABLE "prompts_historico" (
	"id" text PRIMARY KEY NOT NULL,
	"prompt_customizado_id" text,
	"conteudo_anterior" text NOT NULL,
	"conteudo_novo" text NOT NULL,
	"alterado_por" text,
	"alterado_em" text DEFAULT 'now()',
	"justificativa" text
);
--> statement-breakpoint
CREATE TABLE "prompts_sistema" (
	"id" text PRIMARY KEY NOT NULL,
	"modulo" text NOT NULL,
	"chave" text NOT NULL,
	"conteudo_padrao" text NOT NULL,
	"descricao" text,
	"criado_em" text DEFAULT 'now()'
);
--> statement-breakpoint
CREATE TABLE "rag_chunks" (
	"id" serial PRIMARY KEY NOT NULL,
	"documento_nome" text NOT NULL,
	"documento_tipo" text NOT NULL,
	"titulo" text NOT NULL,
	"conteudo" text NOT NULL,
	"pagina_inicio" integer,
	"pagina_fim" integer,
	"tags" text,
	"categoria" text,
	"embedding" text,
	"hash_conteudo" text NOT NULL,
	"criado_em" text DEFAULT 'now()'
);
--> statement-breakpoint
CREATE TABLE "tipos_proponente" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	CONSTRAINT "tipos_proponente_nome_unique" UNIQUE("nome")
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"role" text DEFAULT 'leitor' NOT NULL,
	"status" text DEFAULT 'ativo' NOT NULL,
	"criado_em" text DEFAULT 'now()',
	"atualizado_em" text DEFAULT 'now()',
	CONSTRAINT "usuarios_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "analise_criterios" ADD CONSTRAINT "analise_criterios_analise_id_analise_ia_id_fk" FOREIGN KEY ("analise_id") REFERENCES "public"."analise_ia"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analise_documentos" ADD CONSTRAINT "analise_documentos_analise_id_analise_ia_id_fk" FOREIGN KEY ("analise_id") REFERENCES "public"."analise_ia"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analise_ia" ADD CONSTRAINT "analise_ia_edital_id_editais_id_fk" FOREIGN KEY ("edital_id") REFERENCES "public"."editais"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analise_itens_financiaveis" ADD CONSTRAINT "analise_itens_financiaveis_analise_id_analise_ia_id_fk" FOREIGN KEY ("analise_id") REFERENCES "public"."analise_ia"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analise_pontos_fracos" ADD CONSTRAINT "analise_pontos_fracos_analise_id_analise_ia_id_fk" FOREIGN KEY ("analise_id") REFERENCES "public"."analise_ia"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analise_requisitos" ADD CONSTRAINT "analise_requisitos_analise_id_analise_ia_id_fk" FOREIGN KEY ("analise_id") REFERENCES "public"."analise_ia"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arquivos_anexos" ADD CONSTRAINT "arquivos_anexos_edital_id_editais_id_fk" FOREIGN KEY ("edital_id") REFERENCES "public"."editais"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "motivos_pontuacao" ADD CONSTRAINT "motivos_pontuacao_edital_id_editais_id_fk" FOREIGN KEY ("edital_id") REFERENCES "public"."editais"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "palavras_chave" ADD CONSTRAINT "palavras_chave_edital_id_editais_id_fk" FOREIGN KEY ("edital_id") REFERENCES "public"."editais"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projetos" ADD CONSTRAINT "projetos_edital_id_editais_id_fk" FOREIGN KEY ("edital_id") REFERENCES "public"."editais"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompts_customizados" ADD CONSTRAINT "prompts_customizados_prompt_sistema_id_prompts_sistema_id_fk" FOREIGN KEY ("prompt_sistema_id") REFERENCES "public"."prompts_sistema"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompts_customizados" ADD CONSTRAINT "prompts_customizados_criado_por_usuarios_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompts_historico" ADD CONSTRAINT "prompts_historico_prompt_customizado_id_prompts_customizados_id_fk" FOREIGN KEY ("prompt_customizado_id") REFERENCES "public"."prompts_customizados"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompts_historico" ADD CONSTRAINT "prompts_historico_alterado_por_usuarios_id_fk" FOREIGN KEY ("alterado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_editais_status" ON "editais" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_editais_data_limite" ON "editais" USING btree ("data_limite");--> statement-breakpoint
CREATE INDEX "idx_editais_orgao" ON "editais" USING btree ("orgao");--> statement-breakpoint
CREATE INDEX "idx_editais_score" ON "editais" USING btree ("score_relevancia");--> statement-breakpoint
CREATE INDEX "idx_editais_tecnologia" ON "editais" USING btree ("tecnologia_foco");--> statement-breakpoint
CREATE INDEX "idx_editais_criado_em" ON "editais" USING btree ("criado_em");--> statement-breakpoint
CREATE INDEX "idx_editais_deleted_at" ON "editais" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_funil_decisoes_etapa" ON "funil_decisoes" USING btree ("etapa","resultado");--> statement-breakpoint
CREATE INDEX "idx_jobs_status" ON "jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_jobs_iniciado_em" ON "jobs" USING btree ("iniciado_em");--> statement-breakpoint
CREATE INDEX "idx_logs_nivel" ON "logs_sistema" USING btree ("nivel");--> statement-breakpoint
CREATE INDEX "idx_logs_criado_em" ON "logs_sistema" USING btree ("criado_em");--> statement-breakpoint
CREATE INDEX "idx_logs_contexto" ON "logs_sistema" USING btree ("contexto");--> statement-breakpoint
CREATE INDEX "idx_logs_cenario" ON "logs_sistema" USING btree ("cenario_falha");--> statement-breakpoint
CREATE INDEX "idx_logs_acao" ON "logs_sistema" USING btree ("acao_tomada");--> statement-breakpoint
CREATE INDEX "idx_motivos_edital_fonte" ON "motivos_pontuacao" USING btree ("edital_id","fonte");--> statement-breakpoint
CREATE INDEX "idx_motivos_fonte" ON "motivos_pontuacao" USING btree ("fonte");--> statement-breakpoint
CREATE INDEX "idx_portais_ativo" ON "portais" USING btree ("ativo");--> statement-breakpoint
CREATE INDEX "idx_portais_categoria" ON "portais" USING btree ("categoria");--> statement-breakpoint
CREATE INDEX "idx_projetos_edital_id" ON "projetos" USING btree ("edital_id");--> statement-breakpoint
CREATE INDEX "idx_projetos_status" ON "projetos" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_projetos_criado_em" ON "projetos" USING btree ("criado_em");--> statement-breakpoint
CREATE INDEX "idx_projetos_cientificos_status" ON "projetos_cientificos" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_prompts_customizados_sistema_id" ON "prompts_customizados" USING btree ("prompt_sistema_id");--> statement-breakpoint
CREATE INDEX "idx_prompts_customizados_ativo" ON "prompts_customizados" USING btree ("ativo");--> statement-breakpoint
CREATE INDEX "idx_prompts_historico_customizado_id" ON "prompts_historico" USING btree ("prompt_customizado_id");--> statement-breakpoint
CREATE INDEX "idx_prompts_historico_alterado_em" ON "prompts_historico" USING btree ("alterado_em");--> statement-breakpoint
CREATE INDEX "idx_prompts_sistema_modulo" ON "prompts_sistema" USING btree ("modulo");--> statement-breakpoint
CREATE INDEX "idx_prompts_sistema_chave" ON "prompts_sistema" USING btree ("chave");--> statement-breakpoint
CREATE INDEX "idx_prompts_sistema_modulo_chave" ON "prompts_sistema" USING btree ("modulo","chave");--> statement-breakpoint
CREATE INDEX "idx_rag_documento" ON "rag_chunks" USING btree ("documento_nome");--> statement-breakpoint
CREATE INDEX "idx_rag_categoria" ON "rag_chunks" USING btree ("categoria");--> statement-breakpoint
CREATE INDEX "idx_rag_hash" ON "rag_chunks" USING btree ("hash_conteudo");