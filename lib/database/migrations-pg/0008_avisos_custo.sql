CREATE TABLE IF NOT EXISTS "avisos_custo" (
	"mes" text PRIMARY KEY NOT NULL,
	"criado_em" text NOT NULL,
	"total_usd" real NOT NULL,
	"limite_usd" real NOT NULL,
	"lida" integer DEFAULT 0 NOT NULL
);
