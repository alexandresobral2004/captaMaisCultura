import { eq } from 'drizzle-orm';
import { db } from '../database/db';
import { configuracoes } from '../database/schema';

/**
 * Configurações da aplicação guardadas no Postgres (tabela `configuracoes`).
 * Substitui arquivos JSON em disco, que somem a cada deploy no Railway.
 */

/** Lê e desserializa a configuração. Devolve null se a chave não existe. */
export async function lerConfiguracao<T>(chave: string): Promise<T | null> {
  const [linha] = await db.select().from(configuracoes).where(eq(configuracoes.chave, chave)).limit(1);
  return linha ? (JSON.parse(linha.valor) as T) : null;
}

/** Grava (ou substitui) a configuração. */
export async function gravarConfiguracao(chave: string, valor: unknown): Promise<void> {
  const agora = new Date().toISOString();
  const json = JSON.stringify(valor);
  await db
    .insert(configuracoes)
    .values({ chave, valor: json, atualizadoEm: agora })
    .onConflictDoUpdate({ target: configuracoes.chave, set: { valor: json, atualizadoEm: agora } });
}
