import { desc, eq } from 'drizzle-orm';
import { projetosCientificos } from '../schema';
import { BaseRepository } from './base.repository';

/**
 * Persistência do módulo Análise Científica.
 * O projeto completo fica serializado em `dados`; titulo/status são colunas para listagem.
 * API síncrona (better-sqlite3) para manter o mesmo uso de antes, quando era um Map em memória.
 */
export class ProjetoCientificoRepository extends BaseRepository {
  get(id: string): any | undefined {
    const row = this.database
      .select()
      .from(projetosCientificos)
      .where(eq(projetosCientificos.id, id))
      .get();
    return row ? JSON.parse(row.dados) : undefined;
  }

  list(): any[] {
    return this.database
      .select()
      .from(projetosCientificos)
      .orderBy(desc(projetosCientificos.atualizadoEm))
      .all()
      .map((row) => JSON.parse(row.dados));
  }

  save(projeto: { id: string; titulo?: string; status?: string; [chave: string]: any }): void {
    const agora = new Date().toISOString();
    const valores = {
      titulo: projeto.titulo || 'Sem título',
      status: projeto.status || 'rascunho',
      dados: JSON.stringify(projeto),
      atualizadoEm: agora,
    };
    this.database
      .insert(projetosCientificos)
      .values({ id: projeto.id, ...valores, criadoEm: agora })
      .onConflictDoUpdate({ target: projetosCientificos.id, set: valores })
      .run();
  }

  delete(id: string): boolean {
    const resultado = this.database
      .delete(projetosCientificos)
      .where(eq(projetosCientificos.id, id))
      .run();
    return resultado.changes > 0;
  }
}
