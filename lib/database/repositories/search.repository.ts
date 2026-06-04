import { sql, eq, like, and, gte } from 'drizzle-orm';
import { editais } from '../schema';
import { BaseRepository, PaginatedResult } from './base.repository';
import { getRawDb } from '../db';

export interface SearchQuery {
  search: string;
  page?: number;
  limit?: number;
  status?: string;
  orgao?: string;
  tecnologia?: string;
  scoreMin?: number;
}

export class SearchRepository extends BaseRepository {
  async searchFullText(query: SearchQuery): Promise<PaginatedResult<any>> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    // Preparar termo de busca para FTS5
    const searchTerm = this.prepareSearchTerm(query.search);

    // Construir filtros adicionais
    const filters: string[] = [];
    const params: any[] = [searchTerm];

    if (query.status) {
      filters.push(`e.status = ?`);
      params.push(query.status);
    }
    if (query.orgao) {
      filters.push(`e.orgao LIKE ?`);
      params.push(`%${query.orgao}%`);
    }
    if (query.tecnologia) {
      filters.push(`e.tecnologia_foco LIKE ?`);
      params.push(`%${query.tecnologia}%`);
    }
    if (query.scoreMin !== undefined) {
      filters.push(`e.score_relevancia >= ?`);
      params.push(query.scoreMin);
    }

    const whereClause = filters.length ? `AND ${filters.join(' AND ')}` : '';

    // Query principal com busca FTS
    const searchSql = `
      SELECT
        e.*,
        snippet(editais_fts, 1, '<mark>', '</mark>', '...', 30) as titulo_highlight,
        snippet(editais_fts, 2, '<mark>', '</mark>', '...', 50) as descricao_highlight,
        rank as score_rank
      FROM editais e
      JOIN editais_fts ON e.rowid = editais_fts.rowid
      WHERE editais_fts MATCH ?
      AND e.deleted_at IS NULL
      ${whereClause}
      ORDER BY rank
      LIMIT ? OFFSET ?
    `;

    // Query de contagem
    const countSql = `
      SELECT COUNT(*) as total
      FROM editais e
      JOIN editais_fts ON e.rowid = editais_fts.rowid
      WHERE editais_fts MATCH ?
      AND e.deleted_at IS NULL
      ${whereClause}
    `;

    const rawDb = getRawDb();
    const results = rawDb.prepare(searchSql).all(...params, limit, offset) as any[];
    const countResult = rawDb.prepare(countSql).get(...params) as any;

    return {
      data: results,
      total: countResult?.total || 0,
    };
  }

  private prepareSearchTerm(term: string): string {
    // Remover caracteres especiais e adicionar wildcards
    const cleanTerm = term
      .replace(/[^\w\s\u00C0-\u00FF]/g, ' ')
      .trim();

    const words = cleanTerm.split(/\s+/).filter((w) => w.length > 1);

    if (words.length === 0) {
      return `"${cleanTerm}"*`;
    }

    return words.map((word) => `"${word}"*`).join(' OR ');
  }

  async getFiltersDisponiveis() {
    const rawDb = getRawDb();

    const orgaos = rawDb
      .prepare(`SELECT DISTINCT orgao FROM editais WHERE deleted_at IS NULL ORDER BY orgao`)
      .all() as any[];

    const statusList = rawDb
      .prepare(`SELECT DISTINCT status FROM editais WHERE deleted_at IS NULL ORDER BY status`)
      .all() as any[];

    const tecnologias = rawDb
      .prepare(
        `SELECT DISTINCT tecnologia_foco FROM editais WHERE tecnologia_foco IS NOT NULL AND deleted_at IS NULL ORDER BY tecnologia_foco`
      )
      .all() as any[];

    return {
      orgaos: orgaos.map((r) => r.orgao),
      status: statusList.map((r) => r.status),
      tecnologias: tecnologias.map((r) => r.tecnologia_foco),
    };
  }

  async getStats() {
    const rawDb = getRawDb();

    const total = rawDb
      .prepare(`SELECT COUNT(*) as total FROM editais WHERE deleted_at IS NULL`)
      .get() as any;

    const porStatus = rawDb
      .prepare(
        `SELECT status, COUNT(*) as count FROM editais WHERE deleted_at IS NULL GROUP BY status`
      )
      .all() as any[];

    const porOrgao = rawDb
      .prepare(
        `SELECT orgao, COUNT(*) as count FROM editais WHERE deleted_at IS NULL GROUP BY orgao ORDER BY count DESC LIMIT 10`
      )
      .all() as any[];

    const porTecnologia = rawDb
      .prepare(
        `SELECT tecnologia_foco, COUNT(*) as count FROM editais WHERE tecnologia_foco IS NOT NULL AND deleted_at IS NULL GROUP BY tecnologia_foco ORDER BY count DESC LIMIT 10`
      )
      .all() as any[];

    const comPdf = rawDb
      .prepare(`SELECT COUNT(*) as total FROM editais WHERE pdf_path IS NOT NULL AND deleted_at IS NULL`)
      .get() as any;

    const comAnalise = rawDb
      .prepare(
        `SELECT COUNT(*) as total FROM analise_ia JOIN editais ON analise_ia.edital_id = editais.id WHERE editais.deleted_at IS NULL`
      )
      .get() as any;

    return {
      totalEditais: total?.total || 0,
      comPdf: comPdf?.total || 0,
      comAnaliseIa: comAnalise?.total || 0,
      porStatus: porStatus.reduce((acc: any, r: any) => {
        acc[r.status] = r.count;
        return acc;
      }, {}),
      porOrgao: porOrgao.map((r) => ({ orgao: r.orgao, count: r.count })),
      porTecnologia: porTecnologia.map((r) => ({
        tecnologia: r.tecnologia_foco,
        count: r.count,
      })),
    };
  }
}
