import { desc, eq } from 'drizzle-orm';
import { projetosCientificos } from '../schema';
import { BaseRepository } from './base.repository';

/**
 * Persistência do módulo Análise Científica.
 * O projeto completo fica serializado em `dados`; titulo/status são colunas para listagem.
 * Reescrito para API assíncrona (Drizzle/Postgres).
 */
export class ProjetoCientificoRepository extends BaseRepository {
  async get(id: string): Promise<any | undefined> {
    const rows = await (this.database as any)
      .select()
      .from(projetosCientificos)
      .where(eq(projetosCientificos.id, id));
    const row = rows[0];
    return row ? JSON.parse(row.dados) : undefined;
  }

  async list(): Promise<any[]> {
    const rows = await (this.database as any)
      .select()
      .from(projetosCientificos)
      .orderBy(desc(projetosCientificos.atualizadoEm));
    return rows.map((row: any) => JSON.parse(row.dados));
  }

  async save(projeto: { id: string; titulo?: string; status?: string; [chave: string]: any }): Promise<void> {
    const agora = new Date().toISOString();
    const valores = {
      titulo: projeto.titulo || 'Sem título',
      status: projeto.status || 'rascunho',
      dados: JSON.stringify(projeto),
      atualizadoEm: agora,
    };
    await (this.database as any)
      .insert(projetosCientificos)
      .values({ id: projeto.id, ...valores, criadoEm: agora })
      .onConflictDoUpdate({ target: projetosCientificos.id, set: valores });
  }

  async delete(id: string): Promise<boolean> {
    const resultado = await (this.database as any)
      .delete(projetosCientificos)
      .where(eq(projetosCientificos.id, id))
      .returning({ id: projetosCientificos.id });
    return resultado.length > 0;
  }
}
