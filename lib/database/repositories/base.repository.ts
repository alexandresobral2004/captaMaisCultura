import { db, getRawDb } from '../db';
import { eq, desc, and, gte, lte, like, sql, SQL, asc } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

export interface PaginatedQuery {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
}

export class BaseRepository {
  protected database = db;
  protected rawDb = getRawDb();

  protected async findPaginated<T extends SQLiteTable>(
    table: T,
    options: {
      page: number;
      limit: number;
      where?: SQL;
      orderBy?: SQL[];
    }
  ): Promise<PaginatedResult<any>> {
    const { page, limit, where, orderBy } = options;
    const offset = (page - 1) * limit;

    const conditions = where ? [where] : [];

    const [data, countResult] = await Promise.all([
      this.database
        .select()
        .from(table)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(...(orderBy || [desc((table as any).criadoEm || (table as any).id)]))
        .limit(limit)
        .offset(offset),
      this.database
        .select({ count: sql<number>`count(*)` })
        .from(table)
        .where(conditions.length ? and(...conditions) : undefined),
    ]);

    return {
      data,
      total: Number(countResult[0]?.count || 0),
    };
  }

  protected buildSortOrder(
    table: any,
    sortBy: string,
    sortOrder: 'asc' | 'desc'
  ): SQL {
    const column = table[sortBy];
    if (!column) {
      return desc(table.criadoEm);
    }
    return sortOrder === 'asc' ? asc(column) : desc(column);
  }
}
