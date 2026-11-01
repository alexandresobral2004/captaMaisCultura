CREATE TABLE IF NOT EXISTS "limites_taxa" (
	"chave" text PRIMARY KEY NOT NULL,
	"contador" integer NOT NULL,
	"expira_em" bigint NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_limites_expira" ON "limites_taxa" ("expira_em");
