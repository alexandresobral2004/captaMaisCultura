import { sql, eq, like, and, gte, isNull, or, desc } from 'drizzle-orm';
import { editais, analiseIa } from '../schema';
import { BaseRepository, PaginatedResult } from './base.repository';
import { db } from '../db';

const isPostgres = (process.env.DATABASE_URL ?? '').startsWith('postgres');

export interface SearchQuery {
  search: string;
  page?: number;
  limit?: number;
  status?: string;
  orgao?: string;
  tecnologia?: string;
  scoreMin?: number;
  categoriaArea?: string;
}

export class SearchRepository extends BaseRepository {
  async searchFullText(query: SearchQuery): Promise<PaginatedResult<any>> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    // Preparar termos de busca para to_tsquery do Postgres
    const searchTerm = this.prepareSearchTerm(query.search);

    // Construir condições
    const ftsCondition = isPostgres
      ? sql`to_tsvector('portuguese', coalesce(${editais.titulo},'') || ' ' || coalesce(${editais.descricao},'') || ' ' || coalesce(${editais.orgao},'') || ' ' || coalesce(${editais.conteudoCompleto},'')) @@ plainto_tsquery('portuguese', ${query.search})`
      : or(
          like(editais.titulo, `%${query.search}%`),
          like(editais.descricao, `%${query.search}%`),
          like(editais.orgao, `%${query.search}%`),
        );

    const conditions: any[] = [
      isNull(editais.deletedAt),
      ftsCondition,
    ];

    if (query.status) {
      conditions.push(eq(editais.status, query.status));
    }
    if (query.orgao) {
      conditions.push(like(editais.orgao, `%${query.orgao}%`));
    }
    if (query.tecnologia) {
      conditions.push(like(editais.tecnologiaFoco, `%${query.tecnologia}%`));
    }
    if (query.scoreMin !== undefined) {
      conditions.push(gte(editais.scoreRelevancia, query.scoreMin));
    }
    if (query.categoriaArea) {
      conditions.push(eq(editais.categoriaArea, query.categoriaArea));
    }

    const where = and(...conditions);

    const orderExpr = isPostgres
      ? sql`ts_rank(
            to_tsvector('portuguese', coalesce(${editais.titulo},'') || ' ' || coalesce(${editais.descricao},'') || ' ' || coalesce(${editais.orgao},'')),
            plainto_tsquery('portuguese', ${query.search})
          ) DESC`
      : sql`criado_em DESC`;

    const [results, countResult] = await Promise.all([
      db
        .select()
        .from(editais)
        .where(where)
        .orderBy(orderExpr)
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(editais)
        .where(where),
    ]);

    return {
      data: results,
      total: Number(countResult[0]?.count || 0),
    };
  }

  private prepareSearchTerm(term: string): string {
    // Limpeza básica para uso em plainto_tsquery
    return term.trim().replace(/[^\w\sÀ-ÿ]/g, ' ').trim();
  }

  async getFiltersDisponiveis() {
    const [orgaos, statusList, tecnologias] = await Promise.all([
      db
        .selectDistinct({ orgao: editais.orgao })
        .from(editais)
        .where(isNull(editais.deletedAt))
        .orderBy(editais.orgao),
      db
        .selectDistinct({ status: editais.status })
        .from(editais)
        .where(isNull(editais.deletedAt))
        .orderBy(editais.status),
      db
        .selectDistinct({ tecnologiaFoco: editais.tecnologiaFoco })
        .from(editais)
        .where(and(isNull(editais.deletedAt), sql`${editais.tecnologiaFoco} IS NOT NULL`))
        .orderBy(editais.tecnologiaFoco),
    ]);

    return {
      orgaos: orgaos.map((r: any) => r.orgao),
      status: statusList.map((r: any) => r.status),
      tecnologias: tecnologias.map((r: any) => r.tecnologiaFoco),
    };
  }

  async getStats() {
    const [total, porStatus, porOrgao, porTecnologia, comPdf, comAnalise] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(editais)
        .where(isNull(editais.deletedAt)),
      db
        .select({ status: editais.status, count: sql<number>`count(*)`.mapWith(Number) })
        .from(editais)
        .where(isNull(editais.deletedAt))
        .groupBy(editais.status),
      db
        .select({ orgao: editais.orgao, count: sql<number>`count(*)`.mapWith(Number) })
        .from(editais)
        .where(isNull(editais.deletedAt))
        .groupBy(editais.orgao)
        .orderBy(sql`count(*) DESC`)
        .limit(10),
      db
        .select({ tecnologiaFoco: editais.tecnologiaFoco, count: sql<number>`count(*)`.mapWith(Number) })
        .from(editais)
        .where(and(isNull(editais.deletedAt), sql`${editais.tecnologiaFoco} IS NOT NULL`))
        .groupBy(editais.tecnologiaFoco)
        .orderBy(sql`count(*) DESC`)
        .limit(10),
      db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(editais)
        .where(and(isNull(editais.deletedAt), sql`${editais.pdfPath} IS NOT NULL`)),
      db
        .select({ total: sql<number>`count(*)`.mapWith(Number) })
        .from(analiseIa)
        .innerJoin(editais, sql`${analiseIa.editalId} = ${editais.id}`)
        .where(isNull(editais.deletedAt)),
    ]);

    return {
      totalEditais: Number(total[0]?.count || 0),
      comPdf: Number(comPdf[0]?.count || 0),
      comAnaliseIa: Number((comAnalise as any)?.[0]?.total || 0),
      porStatus: porStatus.reduce((acc: any, r: any) => {
        acc[r.status!] = r.count;
        return acc;
      }, {}),
      porOrgao: porOrgao.map((r: any) => ({ orgao: r.orgao, count: r.count })),
      porTecnologia: porTecnologia.map((r: any) => ({
        tecnologia: r.tecnologiaFoco,
        count: r.count,
      })),
    };
  }
}
