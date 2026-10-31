ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "tipo" text NOT NULL DEFAULT 'varredura_semanal';--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "progresso" text;--> statement-breakpoint
ALTER TABLE "buscas_editais" ADD COLUMN IF NOT EXISTS "job_id" text;--> statement-breakpoint
ALTER TABLE "editais" ADD COLUMN IF NOT EXISTS "tentativas_analise" integer DEFAULT 0;--> statement-breakpoint
-- Excedentes: se houver mais de um job ativo, mantém o RODANDO (ou, sem ele, o mais recente) e encerra os outros, senão o índice único falha
UPDATE "jobs"
SET "status" = 'ERRO',
    "finalizado_em" = now()::text,
    "atualizado_em" = now()::text,
    "erro_detalhes" = '[{"mensagem":"Encerrado pela migração 0004: mais de um job ativo"}]'
WHERE "status" IN ('PENDENTE', 'RODANDO')
  AND "id" <> (
    SELECT "id" FROM "jobs"
    WHERE "status" IN ('PENDENTE', 'RODANDO')
    ORDER BY ("status" = 'RODANDO') DESC, "iniciado_em" DESC, "id"
    LIMIT 1
  );--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_jobs_um_ativo" ON "jobs" ((1)) WHERE status IN ('PENDENTE', 'RODANDO');
