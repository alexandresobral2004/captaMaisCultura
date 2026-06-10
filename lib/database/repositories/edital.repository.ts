import { eq, desc, and, gte, lte, like, sql } from 'drizzle-orm';
import { editais, analiseIa, palavrasChave, arquivosAnexos, motivosPontuacao } from '../schema';
import { BaseRepository, PaginatedResult } from './base.repository';
import { getRawDb } from '../db';

export interface ListEditalQuery {
  page: number;
  limit: number;
  status?: string;
  statusAnalise?: string;
  orgao?: string;
  tecnologia?: string;
  scoreMin?: number;
  scoreMax?: number;
  dataInicio?: string;
  dataFim?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  categoriaArea?: string;
}

export interface CreateEditalDTO {
  id: string;
  titulo: string;
  orgao: string;
  valor?: string;
  valorMin?: number;
  valorMax?: number;
  dataPublicacao?: string;
  dataAbertura?: string;
  dataLimite: string;
  dataResultado?: string;
  status?: string;
  statusAnalise?: string;
  erroAnalise?: string;
  modalidade?: string;
  abrangencia?: string;
  tipoProponente?: string[];
  areasTematicas?: string[];
  tipoEdital?: string;
  descricao?: string;
  link: string;
  pdfUrl?: string;
  pdfPath?: string;
  conteudoCompleto?: string;
  fonteConteudo?: string;
  arquivosAnexos?: any[];
  tecnologiaFoco?: string;
  tipoFerramenta?: string;
  scoreRelevancia?: number;
  scoreConfiancaIa?: number;
  validadoPorIa?: boolean;
  motivoRejeicao?: string;
  foraDoEscopo?: boolean | null;
  dataValidacaoIa?: string;
  scorePontuacao?: number;
  nivelPontuacao?: string;
  motivosPontuacao?: string[];
  modoAnaliseIa?: string;
  hashPontuacao?: string;
  cacheClassificacaoUsado?: boolean;
  confiancaPorCampo?: Record<string, number>;
  scoreValidacaoKeywords?: number;
  densidadeKeywords?: number;
  oportunidadesDetectadas?: string[];
  codigo?: string;
  categoriaArea?: string;
}

function formatToISODate(dateStr: string | null | undefined): string {
  if (!dateStr) return '9999-12-31';
  
  const trimmed = dateStr.trim();
  
  // Se já está no formato YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  
  // Se está no formato YYYY-MM-DD com hora/timezone
  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
    return trimmed.substring(0, 10);
  }
  
  // Se está no formato DD/MM/YYYY
  const parts = trimmed.split('/');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    if (year.length === 4 && day.length === 2 && month.length === 2) {
      return `${year}-${month}-${day}`;
    }
  }
  
  return dateStr;
}

export class EditalRepository extends BaseRepository {

  async generateNextCodigo(): Promise<string> {
    const result = await this.database
      .select({ codigo: editais.codigo })
      .from(editais)
      .where(sql`${editais.codigo} IS NOT NULL`)
      .orderBy(desc(editais.codigo))
      .limit(1);

    let nextNum = 1;
    if (result.length > 0 && result[0].codigo) {
      const lastCodigo = result[0].codigo;
      const match = lastCodigo.match(/^EDT-(\d+)$/);
      if (match) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }
    return `EDT-${String(nextNum).padStart(3, '0')}`;
  }
  async findAll(query: ListEditalQuery): Promise<PaginatedResult<any>> {
    const conditions = [];

    if (query.status) {
      conditions.push(eq(editais.status, query.status as any));
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
    if (query.scoreMax !== undefined) {
      conditions.push(lte(editais.scoreRelevancia, query.scoreMax));
    }
    if (query.dataInicio) {
      conditions.push(gte(editais.dataLimite, query.dataInicio));
    }
    if (query.dataFim) {
      conditions.push(lte(editais.dataLimite, query.dataFim));
    }
    if (query.categoriaArea) {
      conditions.push(eq(editais.categoriaArea, query.categoriaArea));
    }

    const where = conditions.length ? and(...conditions) : undefined;
    const orderBy = this.buildSortOrder(
      editais,
      query.sortBy || 'criadoEm',
      query.sortOrder || 'desc'
    );

    return this.findPaginated(editais, {
      page: query.page,
      limit: query.limit,
      where,
      orderBy: [orderBy],
    });
  }

  async findById(id: string) {
    const result = await this.database
      .select()
      .from(editais)
      .where(eq(editais.id, id))
      .limit(1);

    return result[0] || null;
  }

  async findByIdWithRelations(id: string) {
    const edital = await this.findById(id);
    if (!edital) return null;

    const [analise, palavras, arquivos, motivos] = await Promise.all([
      this.database
        .select()
        .from(analiseIa)
        .where(eq(analiseIa.editalId, id))
        .limit(1),
      this.database
        .select()
        .from(palavrasChave)
        .where(eq(palavrasChave.editalId, id)),
      this.database
        .select()
        .from(arquivosAnexos)
        .where(eq(arquivosAnexos.editalId, id)),
      this.database
        .select()
        .from(motivosPontuacao)
        .where(eq(motivosPontuacao.editalId, id)),
    ]);

    return {
      ...edital,
      analiseIa: analise[0] || null,
      palavrasChave: palavras,
      arquivosAnexosDb: arquivos,
      motivosPontuacaoDb: motivos,
    };
  }

  async create(data: CreateEditalDTO) {
    const codigo = data.codigo || await this.generateNextCodigo();

    const editalData = {
      id: data.id,
      titulo: data.titulo,
      orgao: data.orgao,
      valor: data.valor || null,
      valorMin: data.valorMin || null,
      valorMax: data.valorMax || null,
      dataPublicacao: data.dataPublicacao || null,
      dataLimite: formatToISODate(data.dataLimite),
      dataResultado: data.dataResultado || null,
      status: (data.status || 'Aberto') as any,
      statusAnalise: (data.statusAnalise || 'pendente') as any,
      erroAnalise: data.erroAnalise || null,
      modalidade: data.modalidade || null,
      abrangencia: data.abrangencia || null,
      tipoProponente: data.tipoProponente ? JSON.stringify(data.tipoProponente) : null,
      areasTematicas: data.areasTematicas ? JSON.stringify(data.areasTematicas) : null,
      tipoEdital: (data.tipoEdital || null) as any,
      descricao: data.descricao || null,
      link: data.link,
      pdfUrl: data.pdfUrl || null,
      pdfPath: data.pdfPath || null,
      conteudoCompleto: data.conteudoCompleto || null,
      fonteConteudo: (data.fonteConteudo || null) as any,
      arquivosAnexos: data.arquivosAnexos ? JSON.stringify(data.arquivosAnexos) : null,
      tecnologiaFoco: data.tecnologiaFoco || null,
      tipoFerramenta: data.tipoFerramenta || null,
      scoreRelevancia: data.scoreRelevancia || null,
      scoreConfiancaIa: data.scoreConfiancaIa || null,
      validadoPorIa: !!data.validadoPorIa,
      motivoRejeicao: data.motivoRejeicao || null,
      foraDoEscopo: !!data.foraDoEscopo,
      dataValidacaoIa: data.dataValidacaoIa || null,
      scorePontuacao: data.scorePontuacao || null,
      nivelPontuacao: (data.nivelPontuacao || null) as any,
      motivosPontuacao: data.motivosPontuacao ? JSON.stringify(data.motivosPontuacao) : null,
      modoAnaliseIa: (data.modoAnaliseIa || null) as any,
      hashPontuacao: data.hashPontuacao || null,
      cacheClassificacaoUsado: !!data.cacheClassificacaoUsado,
      confiancaPorCampo: data.confiancaPorCampo ? JSON.stringify(data.confiancaPorCampo) : null,
      codigo: codigo,
      categoriaArea: data.categoriaArea || 'Cultura',
    };

    const result = await this.database.insert(editais).values(editalData).returning();
    return result[0];
  }

  async update(id: string, data: Partial<CreateEditalDTO>) {
    const updateData: any = { atualizadoEm: new Date().toISOString() };

    if (data.titulo !== undefined) updateData.titulo = data.titulo;
    if (data.orgao !== undefined) updateData.orgao = data.orgao;
    if (data.valor !== undefined) updateData.valor = data.valor;
    if (data.valorMin !== undefined) updateData.valorMin = data.valorMin;
    if (data.valorMax !== undefined) updateData.valorMax = data.valorMax;
    if (data.dataPublicacao !== undefined) updateData.dataPublicacao = data.dataPublicacao;
    if (data.dataLimite !== undefined) updateData.dataLimite = formatToISODate(data.dataLimite);
    if (data.dataResultado !== undefined) updateData.dataResultado = data.dataResultado;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.statusAnalise !== undefined) updateData.statusAnalise = data.statusAnalise;
    if (data.erroAnalise !== undefined) updateData.erroAnalise = data.erroAnalise;
    if (data.modalidade !== undefined) updateData.modalidade = data.modalidade;
    if (data.abrangencia !== undefined) updateData.abrangencia = data.abrangencia;
    if (data.descricao !== undefined) updateData.descricao = data.descricao;
    if (data.link !== undefined) updateData.link = data.link;
    if (data.pdfUrl !== undefined) updateData.pdfUrl = data.pdfUrl;
    if (data.pdfPath !== undefined) updateData.pdfPath = data.pdfPath;
    if (data.conteudoCompleto !== undefined) updateData.conteudoCompleto = data.conteudoCompleto;
    if (data.fonteConteudo !== undefined) updateData.fonteConteudo = data.fonteConteudo;
    if (data.tecnologiaFoco !== undefined) updateData.tecnologiaFoco = data.tecnologiaFoco;
    if (data.tipoFerramenta !== undefined) updateData.tipoFerramenta = data.tipoFerramenta;
    if (data.scoreRelevancia !== undefined) updateData.scoreRelevancia = data.scoreRelevancia;
    if (data.scoreConfiancaIa !== undefined) updateData.scoreConfiancaIa = data.scoreConfiancaIa;
    if (data.validadoPorIa !== undefined) updateData.validadoPorIa = data.validadoPorIa ? 1 : 0;
    if (data.motivoRejeicao !== undefined) updateData.motivoRejeicao = data.motivoRejeicao;
    if (data.foraDoEscopo !== undefined) updateData.foraDoEscopo = data.foraDoEscopo ? 1 : 0;
    if (data.dataValidacaoIa !== undefined) updateData.dataValidacaoIa = data.dataValidacaoIa;
    if (data.scorePontuacao !== undefined) updateData.scorePontuacao = data.scorePontuacao;
    if (data.nivelPontuacao !== undefined) updateData.nivelPontuacao = data.nivelPontuacao;
    if (data.modoAnaliseIa !== undefined) updateData.modoAnaliseIa = data.modoAnaliseIa;
    if (data.hashPontuacao !== undefined) updateData.hashPontuacao = data.hashPontuacao;
    if (data.confiancaPorCampo !== undefined) updateData.confiancaPorCampo = JSON.stringify(data.confiancaPorCampo);
    if (data.tipoProponente !== undefined) updateData.tipoProponente = JSON.stringify(data.tipoProponente);
    if (data.areasTematicas !== undefined) updateData.areasTematicas = JSON.stringify(data.areasTematicas);
    if (data.arquivosAnexos !== undefined) updateData.arquivosAnexos = JSON.stringify(data.arquivosAnexos);
    if (data.motivosPontuacao !== undefined) updateData.motivosPontuacao = JSON.stringify(data.motivosPontuacao);
    if (data.categoriaArea !== undefined) updateData.categoriaArea = data.categoriaArea;

    const result = await this.database
      .update(editais)
      .set(updateData)
      .where(eq(editais.id, id))
      .returning();

    return result[0];
  }

  async delete(id: string) {
    await this.database.delete(editais).where(eq(editais.id, id));
  }

  async count(): Promise<number> {
    const result = await this.database
      .select({ count: sql<number>`count(*)` })
      .from(editais)
      .where(sql`${editais.deletedAt} IS NULL`);
    return Number(result[0]?.count || 0);
  }

  async countByStatus(): Promise<Record<string, number>> {
    const result = await this.database
      .select({
        status: editais.status,
        count: sql<number>`count(*)`,
      })
      .from(editais)
      .where(sql`${editais.deletedAt} IS NULL`)
      .groupBy(editais.status);

    const counts: Record<string, number> = {};
    for (const row of result) {
      counts[row.status] = Number(row.count);
    }
    return counts;
  }

  async findWithPdf() {
    return this.database
      .select()
      .from(editais)
      .where(and(
        sql`${editais.pdfPath} IS NOT NULL`,
        sql`${editais.deletedAt} IS NULL`
      ));
  }

  async findByLink(link: string) {
    const result = await this.database
      .select()
      .from(editais)
      .where(eq(editais.link, link))
      .limit(1);

    return result[0] || null;
  }

  async findByIdNotDeleted(id: string) {
    const result = await this.database
      .select()
      .from(editais)
      .where(and(
        eq(editais.id, id),
        sql`${editais.deletedAt} IS NULL`
      ))
      .limit(1);

    return result[0] || null;
  }

  async findByLinkNotDeleted(link: string) {
    const result = await this.database
      .select()
      .from(editais)
      .where(and(
        eq(editais.link, link),
        sql`${editais.deletedAt} IS NULL`
      ))
      .limit(1);

    return result[0] || null;
  }

  async softDelete(id: string) {
    const now = new Date().toISOString();
    await this.database
      .update(editais)
      .set({ deletedAt: now })
      .where(eq(editais.id, id));
  }

  async findAllNotDeleted(query: ListEditalQuery): Promise<PaginatedResult<any>> {
    const conditions = [sql`${editais.deletedAt} IS NULL`];

    if (query.status) {
      conditions.push(eq(editais.status, query.status as any));
    }
    if (query.statusAnalise) {
      conditions.push(eq(editais.statusAnalise, query.statusAnalise as any));
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
    if (query.scoreMax !== undefined) {
      conditions.push(lte(editais.scoreRelevancia, query.scoreMax));
    }
    if (query.dataInicio) {
      conditions.push(gte(editais.dataLimite, query.dataInicio));
    }
    if (query.dataFim) {
      conditions.push(lte(editais.dataLimite, query.dataFim));
    }
    if (query.categoriaArea) {
      conditions.push(eq(editais.categoriaArea, query.categoriaArea));
    }

    const where = conditions.length ? and(...conditions) : undefined;
    const orderBy = this.buildSortOrder(
      editais,
      query.sortBy || 'criadoEm',
      query.sortOrder || 'desc'
    );

    return this.findPaginated(editais, {
      page: query.page,
      limit: query.limit,
      where,
      orderBy: [orderBy],
    });
  }

  async upsert(data: CreateEditalDTO) {
    const existente = await this.findByIdNotDeleted(data.id) || await this.findByLinkNotDeleted(data.link);

    if (existente) {
      return this.update(existente.id, data);
    }
    return this.create(data);
  }
}
