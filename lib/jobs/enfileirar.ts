import crypto from 'crypto';
import { JobRepository } from './job-repository';

export class VarreduraEmAndamento extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'VarreduraEmAndamento';
  }
}

/**
 * Coloca uma varredura na fila (status PENDENTE). Quem executa é o worker (scripts/worker.ts),
 * e não o processo web. Recusa se já houver uma varredura rodando ou aguardando.
 */
export async function enfileirarVarredura(): Promise<{ jobId: string }> {
  const repository = new JobRepository();

  const rodando = await repository.buscarRodando();
  if (rodando) {
    throw new VarreduraEmAndamento(`Já existe um job rodando (ID: ${rodando.id}, Fase: ${rodando.fase})`);
  }
  const pendente = await repository.buscarPendente();
  if (pendente) {
    throw new VarreduraEmAndamento(`Já existe uma varredura aguardando o worker (ID: ${pendente.id})`);
  }

  const jobId = crypto.randomUUID();
  await repository.enfileirar(jobId);
  return { jobId };
}
