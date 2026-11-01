/**
 * Worker de varreduras: roda fora do processo web (no Railway, serviço "worker" com o mesmo repositório).
 *
 * - Liga o agendador semanal, que só enfileira a varredura.
 * - Em loop, reivindica o job PENDENTE mais antigo e executa, um por vez.
 *   A trava do banco (índice único parcial uniq_jobs_um_rodando) garante que só um roda por vez.
 *
 * Uso:
 *   npx tsx scripts/worker.ts
 */
import { JobRunner } from '../lib/jobs/job-runner';
import { JobRepository } from '../lib/jobs/job-repository';
import { iniciarScheduler, pararScheduler } from '../lib/jobs/scheduler';
import { sincronizarFiltros } from '../lib/scraper/filtros/loaders';
import { pipelineLogger } from '../lib/scraper/pipeline-logger';

const INTERVALO_MS = 5000;
let encerrando = false;

function dormir(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Grava o que ainda está na fila de logs. Falha de log não pode derrubar o encerramento. */
async function descarregarLogs(): Promise<void> {
  try {
    await pipelineLogger.descarregar();
  } catch (erro) {
    console.error('⚠️ [Worker] Falha ao gravar logs pendentes:', erro instanceof Error ? erro.name : 'desconhecido');
  }
}

async function main() {
  try {
    await sincronizarFiltros();
    console.log('✅ [Worker] Filtros carregados do banco');
  } catch (erro) {
    console.error('⚠️ [Worker] Falha ao carregar filtros; usando arquivos do repositório:', erro);
  }

  iniciarScheduler();

  const repository = new JobRepository();
  console.log('👷 [Worker] Aguardando varreduras na fila');

  while (!encerrando) {
    try {
      const job = await repository.reivindicarProximoPendente();
      if (job) {
        console.log(`▶️ [Worker] Executando job ${job.id}`);
        const resultado = await new JobRunner().executar(job.id);
        console.log(`🏁 [Worker] Job ${job.id} terminou com status ${resultado.status}`);
      } else {
        await dormir(INTERVALO_MS);
      }
    } catch (erro) {
      console.error('❌ [Worker] Erro no ciclo:', erro);
      await dormir(INTERVALO_MS);
    }
  }

  await descarregarLogs();
  console.log('👋 [Worker] Encerrado');
}

process.on('SIGTERM', () => {
  console.log('⏹️ [Worker] SIGTERM recebido; encerrando após o job atual');
  encerrando = true;
  pararScheduler();
  // Handler síncrono: a gravação roda em paralelo; o fim do main espera a fila também
  void descarregarLogs();
});

main().catch((erro) => {
  console.error('Falha fatal no worker:', erro);
  process.exit(1);
});
