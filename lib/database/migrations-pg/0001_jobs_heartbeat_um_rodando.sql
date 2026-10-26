-- Jobs RODANDO no momento do deploy foram interrompidos pelo próprio deploy: encerra antes de criar a trava
UPDATE "jobs"
SET "status" = 'ERRO',
    "finalizado_em" = now()::text,
    "atualizado_em" = now()::text,
    "erro_detalhes" = COALESCE(NULLIF("erro_detalhes", ''), '[]')
WHERE "status" = 'RODANDO';--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_jobs_um_rodando" ON "jobs" USING btree ("status") WHERE status = 'RODANDO';
