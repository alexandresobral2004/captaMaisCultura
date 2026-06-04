import { eq } from 'drizzle-orm';
import {
  analiseIa,
  analiseRequisitos,
  analiseItensFinanciaveis,
  analiseDocumentos,
  analiseCriterios,
  analisePontosFracos,
} from '../schema';
import { BaseRepository } from './base.repository';

export interface CreateAnaliseDTO {
  editalId: string;
  resumo?: string;
  objetivo?: string;
  elegibilidade?: string;
  contatoEdital?: string;
  scoreAdequacao?: number;
  requisitos?: string[];
  itensFinanciaveis?: string[];
  documentos?: string[];
  criterios?: string[];
  pontosFracos?: string[];
}

export class AnaliseRepository extends BaseRepository {
  async findByEditalId(editalId: string) {
    const analise = await this.database
      .select()
      .from(analiseIa)
      .where(eq(analiseIa.editalId, editalId))
      .limit(1);

    if (!analise[0]) return null;

    const [requisitos, itens, documentos, criterios, pontos] = await Promise.all([
      this.database
        .select()
        .from(analiseRequisitos)
        .where(eq(analiseRequisitos.analiseId, analise[0].id))
        .orderBy(analiseRequisitos.ordem),
      this.database
        .select()
        .from(analiseItensFinanciaveis)
        .where(eq(analiseItensFinanciaveis.analiseId, analise[0].id))
        .orderBy(analiseItensFinanciaveis.ordem),
      this.database
        .select()
        .from(analiseDocumentos)
        .where(eq(analiseDocumentos.analiseId, analise[0].id))
        .orderBy(analiseDocumentos.ordem),
      this.database
        .select()
        .from(analiseCriterios)
        .where(eq(analiseCriterios.analiseId, analise[0].id))
        .orderBy(analiseCriterios.ordem),
      this.database
        .select()
        .from(analisePontosFracos)
        .where(eq(analisePontosFracos.analiseId, analise[0].id))
        .orderBy(analisePontosFracos.ordem),
    ]);

    return {
      ...analise[0],
      requisitos: requisitos.map((r) => r.requisito),
      itensFinanciaveis: itens.map((i) => i.item),
      documentosNecessarios: documentos.map((d) => d.documento),
      criteriosAvaliacao: criterios.map((c) => c.criterio),
      pontosFracos: pontos.map((p) => p.pontoFraco),
    };
  }

  async createOrUpdate(data: CreateAnaliseDTO) {
    // Verificar se ja existe
    const existente = await this.database
      .select()
      .from(analiseIa)
      .where(eq(analiseIa.editalId, data.editalId))
      .limit(1);

    let analiseId: number;

    if (existente[0]) {
      // Atualizar
      await this.database
        .update(analiseIa)
        .set({
          resumo: data.resumo || existente[0].resumo,
          objetivo: data.objetivo || existente[0].objetivo,
          elegibilidade: data.elegibilidade || existente[0].elegibilidade,
          contatoEdital: data.contatoEdital || existente[0].contatoEdital,
          scoreAdequacao: data.scoreAdequacao ?? existente[0].scoreAdequacao,
          atualizadoEm: new Date().toISOString(),
        })
        .where(eq(analiseIa.editalId, data.editalId));
      analiseId = existente[0].id;
    } else {
      // Criar novo
      const result = await this.database
        .insert(analiseIa)
        .values({
          editalId: data.editalId,
          resumo: data.resumo || null,
          objetivo: data.objetivo || null,
          elegibilidade: data.elegibilidade || null,
          contatoEdital: data.contatoEdital || null,
          scoreAdequacao: data.scoreAdequacao || null,
        })
        .returning();
      analiseId = result[0].id;
    }

    // Atualizar listas (deletar e recriar)
    await this.atualizarListas(analiseId, data);

    return this.findByEditalId(data.editalId);
  }

  private async atualizarListas(analiseId: number, data: CreateAnaliseDTO) {
    // Deletar listas existentes
    await Promise.all([
      this.database.delete(analiseRequisitos).where(eq(analiseRequisitos.analiseId, analiseId)),
      this.database.delete(analiseItensFinanciaveis).where(eq(analiseItensFinanciaveis.analiseId, analiseId)),
      this.database.delete(analiseDocumentos).where(eq(analiseDocumentos.analiseId, analiseId)),
      this.database.delete(analiseCriterios).where(eq(analiseCriterios.analiseId, analiseId)),
      this.database.delete(analisePontosFracos).where(eq(analisePontosFracos.analiseId, analiseId)),
    ]);

    // Inserir novas listas
    if (data.requisitos?.length) {
      await this.database.insert(analiseRequisitos).values(
        data.requisitos.map((r, i) => ({
          analiseId,
          requisito: r,
          ordem: i,
        }))
      );
    }

    if (data.itensFinanciaveis?.length) {
      await this.database.insert(analiseItensFinanciaveis).values(
        data.itensFinanciaveis.map((item, i) => ({
          analiseId,
          item,
          ordem: i,
        }))
      );
    }

    if (data.documentos?.length) {
      await this.database.insert(analiseDocumentos).values(
        data.documentos.map((doc, i) => ({
          analiseId,
          documento: doc,
          ordem: i,
        }))
      );
    }

    if (data.criterios?.length) {
      await this.database.insert(analiseCriterios).values(
        data.criterios.map((c, i) => ({
          analiseId,
          criterio: c,
          ordem: i,
        }))
      );
    }

    if (data.pontosFracos?.length) {
      await this.database.insert(analisePontosFracos).values(
        data.pontosFracos.map((p, i) => ({
          analiseId,
          pontoFraco: p,
          ordem: i,
        }))
      );
    }
  }

  async delete(editalId: string) {
    const analise = await this.database
      .select()
      .from(analiseIa)
      .where(eq(analiseIa.editalId, editalId))
      .limit(1);

    if (analise[0]) {
      // Cascade deleta as listas automaticamente
      await this.database.delete(analiseIa).where(eq(analiseIa.editalId, editalId));
    }
  }
}
