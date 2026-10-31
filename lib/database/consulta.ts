import type { SQL } from 'drizzle-orm';

/** Quem executa SQL: o pool do banco ou uma transação aberta. */
export interface Consulta {
  execute(query: SQL): Promise<unknown>;
}
