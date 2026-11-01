CREATE TABLE IF NOT EXISTS "notificacoes" (
	"id" text PRIMARY KEY NOT NULL,
	"tipo" text NOT NULL,
	"titulo" text NOT NULL,
	"descricao" text DEFAULT '' NOT NULL,
	"quantidade" integer DEFAULT 1 NOT NULL,
	"link" text NOT NULL,
	"lida" integer DEFAULT 0 NOT NULL,
	"urgencia" text DEFAULT 'media' NOT NULL,
	"criado_em" text NOT NULL
);
