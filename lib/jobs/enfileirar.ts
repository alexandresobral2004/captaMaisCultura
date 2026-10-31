import crypto from 'crypto';
import { JobRepository } from './job-repository';
import { TipoJob } from './job-types';

export class VarreduraEmAndamento extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'VarreduraEmAndamento';
  }
}

/** Erro 23505 (unique_violation) do Postgres, direto ou embrulhado pelo drizzle em `cause`. */
export function ehConflitoDeFila(erro: unknown): boolean {
  if (typeof erro !== 'object' || erro === null) return false;
  if ('code' in erro && erro.code === '23505') return true;
  return 'cause' in erro && ehConflitoDeFila(erro.cause);
}

/**
 * Coloca uma varredura na fila (status PENDENTE). Quem executa é o worker (scripts/worker.ts),
 * e não o processo web. A trava é o índice único uniq_jobs_um_ativo: só um job ativo por vez.
 */
export async function enfileirarVarredura(): Promise<{ jobId: string }> {
  const repository = new JobRepository();

  // Atalho de leitura: evita inserir quando já se sabe que há job ativo. A garantia continua no índice (abaixo)
  const rodando = await repository.buscarRodando();
  if (rodando) {
    throw new VarreduraEmAndamento(`Já existe um job rodando (ID: ${rodando.id}, Fase: ${rodando.fase})`);
  }
  const pendente = await repository.buscarPendente();
  if (pendente) {
    throw new VarreduraEmAndamento(`Já existe uma varredura aguardando o worker (ID: ${pendente.id})`);
  }

  const jobId = crypto.randomUUID();
  try {
    await repository.enfileirar(jobId, TipoJob.VARREDURA_SEMANAL);
  } catch (erro) {
    if (ehConflitoDeFila(erro)) {
      throw new VarreduraEmAndamento('Já existe um job ativo (rodando ou aguardando o worker)');
    }
    throw erro;
  }
  return { jobId };
}
