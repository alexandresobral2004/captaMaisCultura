import { NextRequest, NextResponse } from 'next/server';
import { progressoInicial, type ProgressoBusca } from '@/lib/scraper/progresso-busca';
import { JobRepository } from '@/lib/jobs/job-repository';
import { type JobRecord, JobStatus, TipoJob } from '@/lib/jobs/job-types';
import { recuperarOrfaosAsync } from '@/lib/scraper/controle-busca';
import { verificarAdmin } from '@/lib/api/auth';

export const dynamic = 'force-dynamic';

const MENSAGEM_PADRAO_INTERRUPCAO = 'Busca interrompida';

/** Última mensagem registrada em erroDetalhes (JSON de ErroFase[]), ou o texto padrão. */
function mensagemDoErro(erroDetalhes: string | null): string {
  try {
    const lista: unknown = JSON.parse(erroDetalhes ?? '[]');
    if (Array.isArray(lista) && lista.length > 0) {
      const ultimo: unknown = lista[lista.length - 1];
      if (typeof ultimo === 'object' && ultimo !== null && 'mensagem' in ultimo && typeof ultimo.mensagem === 'string') {
        return ultimo.mensagem;
      }
    }
  } catch {
    // erroDetalhes fora do formato: cai no texto padrão
  }
  return MENSAGEM_PADRAO_INTERRUPCAO;
}

/**
 * O job termina em ERRO ou CONCLUIDO mesmo sem snapshot final (job vencido, worker morto).
 * A tela precisa ver a etapa final, senão fica em "buscando" para sempre.
 */
function progressoDoJob(job: JobRecord): ProgressoBusca {
  if (job.status === JobStatus.ERRO && job.progresso?.etapa !== 'erro') {
    return { ...(job.progresso ?? progressoInicial()), etapa: 'erro', atual: mensagemDoErro(job.erroDetalhes) };
  }
  if (job.status === JobStatus.CONCLUIDO && job.progresso?.etapa !== 'concluida') {
    return { ...(job.progresso ?? progressoInicial()), etapa: 'concluida', percentual: 100 };
  }
  return job.progresso ?? progressoInicial();
}

/**
 * Andamento de uma busca manual, lido do banco (vale para qualquer instância do web).
 * Com ?jobId= devolve o job pedido (404 se não existir); sem ele, o último job de busca manual.
 */
export async function GET(request: NextRequest) {
  const auth = await verificarAdmin(request);
  if (!auth.ok) return auth.response;

  // Consultar também recupera o que ficou preso (job sem worker ou sem heartbeat)
  await recuperarOrfaosAsync();
  const jobId = request.nextUrl.searchParams.get('jobId');
  const repository = new JobRepository();
  const job = jobId
    ? await repository.buscarPorId(jobId)
    : await repository.buscarUltimoDeTipo(TipoJob.BUSCA_MANUAL);

  if (jobId && !job) {
    return NextResponse.json({ error: 'Job não encontrado' }, { status: 404 });
  }
  return NextResponse.json(job ? progressoDoJob(job) : progressoInicial());
}
