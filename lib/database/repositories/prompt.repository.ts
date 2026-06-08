import { eq, and, desc } from 'drizzle-orm';
import {
  promptsSistema,
  promptsCustomizados,
  promptsHistorico,
} from '../schema';
import { BaseRepository } from './base.repository';

export interface CreatePromptSistemaDTO {
  id: string;
  modulo: string;
  chave: string;
  conteudoPadrao: string;
  descricao?: string;
}

export interface CreatePromptCustomizadoDTO {
  id: string;
  promptSistemaId: string;
  conteudo: string;
  criadoPor?: string;
}

export interface CreatePromptHistoricoDTO {
  id: string;
  promptCustomizadoId: string;
  conteudoAnterior: string;
  conteudoNovo: string;
  alteradoPor?: string;
  justificativa?: string;
}

export interface PromptCompletocomHistorico {
  id: string;
  modulo: string;
  chave: string;
  conteudo: string;
  descricao?: string;
  ativo: boolean;
  customizado: boolean;
  criadoEm?: string;
  atualizadoEm?: string;
  criadoPor?: string;
  historico: Array<{
    id: string;
    conteudoAnterior: string;
    conteudoNovo: string;
    alteradoEm: string;
    alteradoPor?: string;
    justificativa?: string;
  }>;
}

export class PromptRepository extends BaseRepository {
  async getAllSistema() {
    return this.database
      .select()
      .from(promptsSistema)
      .orderBy(desc(promptsSistema.criadoEm));
  }

  async getSistemaById(id: string) {
    const results = await this.database
      .select()
      .from(promptsSistema)
      .where(eq(promptsSistema.id, id));
    return results[0] || null;
  }

  async getSistemaByModuloChave(modulo: string, chave: string) {
    const results = await this.database
      .select()
      .from(promptsSistema)
      .where(
        and(
          eq(promptsSistema.modulo, modulo),
          eq(promptsSistema.chave, chave)
        )
      );
    return results[0] || null;
  }

  async createSistema(data: CreatePromptSistemaDTO) {
    await this.database
      .insert(promptsSistema)
      .values({
        id: data.id,
        modulo: data.modulo,
        chave: data.chave,
        conteudoPadrao: data.conteudoPadrao,
        descricao: data.descricao,
      });
  }

  async getAllCustomizados() {
    return this.database
      .select()
      .from(promptsCustomizados)
      .orderBy(desc(promptsCustomizados.criadoEm));
  }

  async getCustomizadoBySistemaId(promptSistemaId: string) {
    const results = await this.database
      .select()
      .from(promptsCustomizados)
      .where(
        and(
          eq(promptsCustomizados.promptSistemaId, promptSistemaId),
          eq(promptsCustomizados.ativo, true)
        )
      )
      .limit(1);
    return results[0] || null;
  }

  async getAtivo(modulo: string, chave: string): Promise<string | null> {
    const promptSistema = await this.getSistemaByModuloChave(modulo, chave);
    if (!promptSistema) return null;

    const customizado = await this.getCustomizadoBySistemaId(promptSistema.id);
    if (customizado) {
      return customizado.conteudo;
    }

    return promptSistema.conteudoPadrao;
  }

  async createCustomizado(data: CreatePromptCustomizadoDTO) {
    const now = new Date().toISOString();
    
    await this.database.transaction(async (tx) => {
      await tx
        .insert(promptsCustomizados)
        .values({
          id: data.id,
          promptSistemaId: data.promptSistemaId,
          conteudo: data.conteudo,
          criadoPor: data.criadoPor,
          criadoEm: now,
          atualizadoEm: now,
        });
    });
  }

  async updateCustomizado(id: string, conteudo: string, alteradoPor?: string, justificativa?: string) {
    const now = new Date().toISOString();
    
    await this.database.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(promptsCustomizados)
        .where(eq(promptsCustomizados.id, id))
        .limit(1);

      if (existing.length === 0) {
        throw new Error('Prompt customizado não encontrado');
      }

      const conteudoAnterior = existing[0].conteudo;

      await tx
        .update(promptsCustomizados)
        .set({
          conteudo,
          atualizadoEm: now,
        })
        .where(eq(promptsCustomizados.id, id));

      if (conteudoAnterior !== conteudo) {
        await tx
          .insert(promptsHistorico)
          .values({
            id: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            promptCustomizadoId: id,
            conteudoAnterior,
            conteudoNovo: conteudo,
            alteradoPor,
            alteradoEm: now,
            justificativa,
          });
      }
    });
  }

  async deactivateCustomizado(promptSistemaId: string) {
    await this.database
      .update(promptsCustomizados)
      .set({ ativo: false })
      .where(eq(promptsCustomizados.promptSistemaId, promptSistemaId));
  }

  async createCustomizadoFromSistema(
    promptSistemaId: string,
    conteudo: string,
    criadoPor?: string
  ): Promise<string> {
    const id = `prompt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await this.database.transaction(async (tx) => {
      await tx
        .update(promptsCustomizados)
        .set({ ativo: false })
        .where(eq(promptsCustomizados.promptSistemaId, promptSistemaId));

      await tx
        .insert(promptsCustomizados)
        .values({
          id,
          promptSistemaId,
          conteudo,
          criadoPor,
          criadoEm: new Date().toISOString(),
          atualizadoEm: new Date().toISOString(),
        });
    });

    return id;
  }

  async getHistorico(promptCustomizadoId: string) {
    return this.database
      .select()
      .from(promptsHistorico)
      .where(eq(promptsHistorico.promptCustomizadoId, promptCustomizadoId))
      .orderBy(desc(promptsHistorico.alteradoEm));
  }

  async getPromptCompleto(modulo: string, chave: string): Promise<PromptCompletocomHistorico | null> {
    const promptSistema = await this.getSistemaByModuloChave(modulo, chave);
    if (!promptSistema) return null;

    const customizado = await this.getCustomizadoBySistemaId(promptSistema.id);
    const historico = customizado
      ? await this.getHistorico(customizado.id)
      : [];

    return {
      id: promptSistema.id,
      modulo: promptSistema.modulo,
      chave: promptSistema.chave,
      conteudo: customizado?.conteudo || promptSistema.conteudoPadrao,
      descricao: promptSistema.descricao || undefined,
      ativo: !!customizado,
      customizado: !!customizado,
      criadoEm: customizado?.criadoEm || promptSistema.criadoEm || undefined,
      atualizadoEm: customizado?.atualizadoEm || undefined,
      criadoPor: customizado?.criadoPor || undefined,
      historico: historico.map(h => ({
        id: h.id,
        conteudoAnterior: h.conteudoAnterior,
        conteudoNovo: h.conteudoNovo,
        alteradoEm: h.alteradoEm || new Date().toISOString(),
        alteradoPor: h.alteradoPor || undefined,
        justificativa: h.justificativa || undefined,
      })),
    };
  }

  async listarPromptsPorModulo(): Promise<Record<string, PromptCompletocomHistorico[]>> {
    const allSistema = await this.getAllSistema();
    const result: Record<string, PromptCompletocomHistorico[]> = {};

    for (const prompt of allSistema) {
      const completo = await this.getPromptCompleto(prompt.modulo, prompt.chave);
      if (completo) {
        if (!result[prompt.modulo]) {
          result[prompt.modulo] = [];
        }
        result[prompt.modulo].push(completo);
      }
    }

    return result;
  }
}
