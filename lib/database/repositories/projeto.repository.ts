import { eq, desc, and, like, sql } from 'drizzle-orm';
import { projetos, editais } from '../schema';
import { BaseRepository, PaginatedResult } from './base.repository';

export interface ListProjetoQuery {
  page: number;
  limit: number;
  status?: string;
  editalId?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreateProjetoDTO {
  id: string;
  editalId: string;
  titulo: string;
  descricao?: string;
  areaAtuacao?: string;
  propostaUsuario?: string;
  resumoExecutivo?: string;
  justificativa?: string;
  objetivos?: string;
  metodologia?: string;
  resultadosEsperados?: string;
  cronograma?: string;
  orcamentoDetalhado?: string;
  valorSolicitado?: number;
  prazoMeses?: number;
  equipe?: any[] | string;
  criteriosAtendidos?: string[];
  criteriosPendentes?: string[];
  scoreCompliance?: number;
  status?: string;
  versao?: number;
  promptOriginal?: string;
  secoesDinamicas?: any[] | string;
  // Logo e Dados do Proponente
  logoUrl?: string;
  logoDescricao?: string;
  dadosProponente?: any | string;
}

export class ProjetoRepository extends BaseRepository {
  async findAll(query: ListProjetoQuery): Promise<PaginatedResult<any>> {
    const conditions = [];

    if (query.status) {
      conditions.push(eq(projetos.status, query.status as any));
    }
    if (query.editalId) {
      conditions.push(eq(projetos.editalId, query.editalId));
    }
    if (query.search) {
      conditions.push(
        like(projetos.titulo, `%${query.search}%`)
      );
    }

    const where = conditions.length ? and(...conditions) : undefined;
    const orderBy = this.buildSortOrder(
      projetos,
      query.sortBy || 'criadoEm',
      query.sortOrder || 'desc'
    );

    return this.findPaginated(projetos, {
      page: query.page,
      limit: query.limit,
      where,
      orderBy: [orderBy],
    });
  }

  async findById(id: string) {
    const result = await this.database
      .select()
      .from(projetos)
      .where(eq(projetos.id, id))
      .limit(1);

    return result[0] || null;
  }

  async findByIdWithEdital(id: string) {
    const projeto = await this.findById(id);
    if (!projeto) return null;

    const [edital] = await this.database
      .select()
      .from(editais)
      .where(eq(editais.id, projeto.editalId))
      .limit(1);

    return {
      ...projeto,
      edital,
    };
  }

  async findByEditalId(editalId: string) {
    return this.database
      .select()
      .from(projetos)
      .where(eq(projetos.editalId, editalId))
      .orderBy(desc(projetos.criadoEm));
  }

  async create(data: CreateProjetoDTO) {
    const projetoData = {
      id: data.id,
      editalId: data.editalId,
      titulo: data.titulo,
      descricao: data.descricao || null,
      areaAtuacao: data.areaAtuacao || null,
      propostaUsuario: data.propostaUsuario || null,
      resumoExecutivo: data.resumoExecutivo || null,
      justificativa: data.justificativa || null,
      objetivos: data.objetivos || null,
      metodologia: data.metodologia || null,
      resultadosEsperados: data.resultadosEsperados || null,
      cronograma: data.cronograma || null,
      orcamentoDetalhado: data.orcamentoDetalhado || null,
      valorSolicitado: data.valorSolicitado || null,
      prazoMeses: data.prazoMeses || null,
      equipe: data.equipe ? JSON.stringify(data.equipe) : null,
      criteriosAtendidos: data.criteriosAtendidos ? JSON.stringify(data.criteriosAtendidos) : null,
      criteriosPendentes: data.criteriosPendentes ? JSON.stringify(data.criteriosPendentes) : null,
      scoreCompliance: data.scoreCompliance || null,
      status: (data.status || 'rascunho') as any,
      versao: data.versao || 1,
      promptOriginal: data.promptOriginal || null,
      secoesDinamicas: data.secoesDinamicas ? (typeof data.secoesDinamicas === 'string' ? data.secoesDinamicas : JSON.stringify(data.secoesDinamicas)) : null,
      // Logo e Dados do Proponente
      logoUrl: data.logoUrl || null,
      logoDescricao: data.logoDescricao || null,
      dadosProponente: data.dadosProponente ? (typeof data.dadosProponente === 'string' ? data.dadosProponente : JSON.stringify(data.dadosProponente)) : null,
    };

    const result = await this.database.insert(projetos).values(projetoData).returning();
    return result[0];
  }

  async update(id: string, data: Partial<CreateProjetoDTO>) {
    const updateData: any = { atualizadoEm: new Date().toISOString() };

    if (data.titulo !== undefined) updateData.titulo = data.titulo;
    if (data.descricao !== undefined) updateData.descricao = data.descricao;
    if (data.areaAtuacao !== undefined) updateData.areaAtuacao = data.areaAtuacao;
    if (data.propostaUsuario !== undefined) updateData.propostaUsuario = data.propostaUsuario;
    if (data.resumoExecutivo !== undefined) updateData.resumoExecutivo = data.resumoExecutivo;
    if (data.justificativa !== undefined) updateData.justificativa = data.justificativa;
    if (data.objetivos !== undefined) updateData.objetivos = data.objetivos;
    if (data.metodologia !== undefined) updateData.metodologia = data.metodologia;
    if (data.resultadosEsperados !== undefined) updateData.resultadosEsperados = data.resultadosEsperados;
    if (data.cronograma !== undefined) updateData.cronograma = data.cronograma;
    if (data.orcamentoDetalhado !== undefined) updateData.orcamentoDetalhado = data.orcamentoDetalhado;
    if (data.valorSolicitado !== undefined) updateData.valorSolicitado = data.valorSolicitado;
    if (data.prazoMeses !== undefined) updateData.prazoMeses = data.prazoMeses;
    if (data.equipe !== undefined) updateData.equipe = JSON.stringify(data.equipe);
    if (data.criteriosAtendidos !== undefined) updateData.criteriosAtendidos = JSON.stringify(data.criteriosAtendidos);
    if (data.criteriosPendentes !== undefined) updateData.criteriosPendentes = JSON.stringify(data.criteriosPendentes);
    if (data.scoreCompliance !== undefined) updateData.scoreCompliance = data.scoreCompliance;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.versao !== undefined) updateData.versao = data.versao;
    if (data.promptOriginal !== undefined) updateData.promptOriginal = data.promptOriginal;
    if (data.secoesDinamicas !== undefined) {
      updateData.secoesDinamicas = typeof data.secoesDinamicas === 'string'
        ? data.secoesDinamicas
        : JSON.stringify(data.secoesDinamicas);
    }
    // Logo e Dados do Proponente
    if (data.logoUrl !== undefined) updateData.logoUrl = data.logoUrl;
    if (data.logoDescricao !== undefined) updateData.logoDescricao = data.logoDescricao;
    if (data.dadosProponente !== undefined) {
      updateData.dadosProponente = typeof data.dadosProponente === 'string'
        ? data.dadosProponente
        : JSON.stringify(data.dadosProponente);
    }

    const result = await this.database
      .update(projetos)
      .set(updateData)
      .where(eq(projetos.id, id))
      .returning();

    return result[0];
  }

  async delete(id: string) {
    await this.database.delete(projetos).where(eq(projetos.id, id));
  }

  async count(): Promise<number> {
    const result = await this.database
      .select({ count: sql<number>`count(*)` })
      .from(projetos);
    return Number(result[0]?.count || 0);
  }
}
