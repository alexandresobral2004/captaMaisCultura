import { and, asc, desc, eq, gt, lt, lte } from 'drizzle-orm';
import { db } from '../database/db';
import { logsSistema } from '../database/schema';

/** Eventos do pipeline são as linhas de logs_sistema com este contexto. */
const CONTEXTO = 'pipeline';

export interface LinhaPipeline {
  id: number;
  /** JSON do evento, com jobId. */
  detalhes: string | null;
}

/** Maior id de evento do pipeline gravado até agora (0 se não há nenhum). */
export async function ultimoIdPipeline(): Promise<number> {
  const [linha] = await db
    .select({ id: logsSistema.id })
    .from(logsSistema)
    .where(eq(logsSistema.contexto, CONTEXTO))
    .orderBy(desc(logsSistema.id))
    .limit(1);
  return linha?.id ?? 0;
}

/** Últimos eventos até `ate` (inclusive), em ordem crescente de id. */
export async function lerUltimosPipeline(ate: number, limite: number): Promise<LinhaPipeline[]> {
  const linhas = await db
    .select({ id: logsSistema.id, detalhes: logsSistema.detalhes })
    .from(logsSistema)
    .where(and(eq(logsSistema.contexto, CONTEXTO), lte(logsSistema.id, ate)))
    .orderBy(desc(logsSistema.id))
    .limit(limite);
  return linhas.reverse();
}

const RETENCAO_DIAS = 7;

/** Apaga eventos do pipeline com mais de 7 dias. Outros contextos de logs_sistema ficam como estão. */
export async function apagarLogsPipelineAntigos(agora: Date = new Date()): Promise<void> {
  const limite = new Date(agora.getTime() - RETENCAO_DIAS * 24 * 60 * 60 * 1000).toISOString();
  await db
    .delete(logsSistema)
    .where(and(eq(logsSistema.contexto, CONTEXTO), lt(logsSistema.criadoEm, limite)));
}

/** Eventos com id maior que `cursor`, em ordem crescente de id. */
export async function lerDepoisDePipeline(cursor: number, limite = 500): Promise<LinhaPipeline[]> {
  return db
    .select({ id: logsSistema.id, detalhes: logsSistema.detalhes })
    .from(logsSistema)
    .where(and(eq(logsSistema.contexto, CONTEXTO), gt(logsSistema.id, cursor)))
    .orderBy(asc(logsSistema.id))
    .limit(limite);
}
