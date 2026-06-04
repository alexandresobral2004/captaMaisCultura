import { db } from '../db';
import { portais } from '../schema';
import { eq, and } from 'drizzle-orm';

export interface PortalDTO {
  id?: string;
  nome: string;
  urlBusca: string;
  urlsFallback?: string[];
  tipo: 'rss' | 'html' | 'api' | 'session';
  categoria: string;
  ativo?: boolean;
  scraperModule?: string;
  intervaloMinutos?: number;
  credEmail?: string;
}

export interface Portal extends PortalDTO {
  urlsFallback: string[];
  ativo: boolean;
  intervaloMinutos: number;
  ultimoScan: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export class PortalService {
  async listar(): Promise<Portal[]> {
    const results = await db.select().from(portais).all();
    return results.map(this.mapToPortal);
  }

  listarSync(): Portal[] {
    const results = db.select().from(portais).all();
    return results.map(this.mapToPortal);
  }

  async listarAtivos(): Promise<Portal[]> {
    const results = await db.select().from(portais).where(eq(portais.ativo, true)).all();
    return results.map(this.mapToPortal);
  }

  async buscarPorId(id: string): Promise<Portal | null> {
    const result = await db.select().from(portais).where(eq(portais.id, id)).get();
    return result ? this.mapToPortal(result) : null;
  }

  async criar(data: PortalDTO): Promise<Portal> {
    const now = new Date().toISOString();
    const id = data.id || this.generateId(data.nome);

    await db.insert(portais).values({
      id,
      nome: data.nome,
      urlBusca: data.urlBusca,
      urlsFallback: data.urlsFallback ? JSON.stringify(data.urlsFallback) : null,
      tipo: data.tipo,
      categoria: data.categoria,
      ativo: data.ativo ?? true,
      scraperModule: data.scraperModule ?? null,
      intervaloMinutos: data.intervaloMinutos ?? 60,
      credEmail: data.credEmail ?? null,
      criadoEm: now,
      atualizadoEm: now,
    });

    const created = await this.buscarPorId(id);
    if (!created) throw new Error('Erro ao criar portal');
    return created;
  }

  async atualizar(id: string, data: Partial<PortalDTO>): Promise<Portal> {
    const existente = await this.buscarPorId(id);
    if (!existente) {
      throw new Error(`Portal ${id} não encontrado`);
    }

    const updates: Partial<typeof portais.$inferInsert> = {
      atualizadoEm: new Date().toISOString(),
    };

    if (data.nome !== undefined) updates.nome = data.nome;
    if (data.urlBusca !== undefined) updates.urlBusca = data.urlBusca;
    if (data.urlsFallback !== undefined) updates.urlsFallback = JSON.stringify(data.urlsFallback);
    if (data.tipo !== undefined) updates.tipo = data.tipo;
    if (data.categoria !== undefined) updates.categoria = data.categoria;
    if (data.ativo !== undefined) updates.ativo = data.ativo;
    if (data.scraperModule !== undefined) updates.scraperModule = data.scraperModule ?? null;
    if (data.intervaloMinutos !== undefined) updates.intervaloMinutos = data.intervaloMinutos;
    if (data.credEmail !== undefined) updates.credEmail = data.credEmail ?? null;

    await db.update(portais).set(updates).where(eq(portais.id, id));

    const updated = await this.buscarPorId(id);
    if (!updated) throw new Error('Erro ao atualizar portal');
    return updated;
  }

  async toggleAtivo(id: string): Promise<Portal> {
    const existente = await this.buscarPorId(id);
    if (!existente) {
      throw new Error(`Portal ${id} não encontrado`);
    }

    await db.update(portais)
      .set({ ativo: !existente.ativo, atualizadoEm: new Date().toISOString() })
      .where(eq(portais.id, id));

    const updated = await this.buscarPorId(id);
    if (!updated) throw new Error('Erro ao toggle portal');
    return updated;
  }

  async deletar(id: string): Promise<void> {
    const existente = await this.buscarPorId(id);
    if (!existente) {
      throw new Error(`Portal ${id} não encontrado`);
    }

    await db.delete(portais).where(eq(portais.id, id));
  }

  async atualizarUltimoScan(id: string): Promise<void> {
    await db.update(portais)
      .set({ ultimoScan: new Date().toISOString() })
      .where(eq(portais.id, id));
  }

  private generateId(nome: string): string {
    return nome
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 30);
  }

  private mapToPortal(row: any): Portal {
    const urlBusca = row.url_busca ?? row.urlBusca ?? '';
    const urlsFallbackStr = row.urls_fallback ?? row.urlsFallback;
    const ativo = row.ativo ?? row.ativo === 1;
    const scraperModule = row.scraper_module ?? row.scraperModule ?? undefined;
    const intervaloMinutos = row.intervalo_minutos ?? row.intervaloMinutos ?? 60;
    const ultimoScan = row.ultimo_scan ?? row.ultimoScan ?? null;
    const credEmail = row.cred_email ?? row.credEmail ?? undefined;
    const criadoEm = row.criado_em ?? row.criadoEm ?? '';
    const atualizadoEm = row.atualizado_em ?? row.atualizadoEm ?? '';

    return {
      id: row.id,
      nome: row.nome ?? '',
      urlBusca,
      urlsFallback: urlsFallbackStr ? JSON.parse(urlsFallbackStr) : [],
      tipo: row.tipo ?? 'html',
      categoria: row.categoria ?? '',
      ativo,
      scraperModule,
      intervaloMinutos,
      ultimoScan,
      credEmail,
      criadoEm,
      atualizadoEm,
    };
  }
}