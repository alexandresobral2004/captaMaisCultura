CREATE TABLE IF NOT EXISTS "uso_ia" (
	"id" serial PRIMARY KEY NOT NULL,
	"criado_em" text NOT NULL,
	"origem" text NOT NULL,
	"modelo" text NOT NULL,
	"tokens_entrada" integer NOT NULL,
	"tokens_saida" integer NOT NULL,
	"edital_id" text,
	"projeto_id" text
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_uso_ia_criado" ON "uso_ia" ("criado_em");
