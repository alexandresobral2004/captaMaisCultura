import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { notificacoes } from '../schema';

export interface Notificacao {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string;
  quantidade?: number;
  link: string;
  lida: boolean;
  criadoEm: Date;
  urgencia?: string;
}

export interface FiltroNotificacoes {
  lida?: boolean;
  tipo?: string;
  limite?: number;
}

/**
 * Grava a notificação. Com id repetido não faz nada (ON CONFLICT DO NOTHING): é o que torna
 * o aviso mensal de custo único entre réplicas, sem leitura prévia.
 */
export async function salvarNotificacao(notificacao: Notificacao): Promise<void> {
  await db
    .insert(notificacoes)
    .values({
      id: notificacao.id,
      tipo: notificacao.tipo,
      titulo: notificacao.titulo,
      descricao: notificacao.descricao,
      quantidade: notificacao.quantidade ?? 1,
      link: notificacao.link,
      lida: notificacao.lida ? 1 : 0,
      urgencia: notificacao.urgencia ?? 'media',
      criadoEm: notificacao.criadoEm.toISOString(),
    })
    .onConflictDoNothing();
}

/** Notificações mais recentes primeiro, com filtros opcionais por situação de leitura e tipo. */
export async function listarNotificacoes(filtro: FiltroNotificacoes = {}): Promise<Notificacao[]> {
  const condicoes = [];
  if (filtro.lida !== undefined) condicoes.push(eq(notificacoes.lida, filtro.lida ? 1 : 0));
  if (filtro.tipo) condicoes.push(eq(notificacoes.tipo, filtro.tipo));

  const linhas = await db
    .select()
    .from(notificacoes)
    .where(condicoes.length > 0 ? and(...condicoes) : undefined)
    .orderBy(desc(notificacoes.criadoEm))
    .limit(filtro.limite ?? 10_000);

  return linhas.map((linha: typeof linhas[number]) => ({
    id: linha.id,
    tipo: linha.tipo,
    titulo: linha.titulo,
    descricao: linha.descricao,
    quantidade: linha.quantidade,
    link: linha.link,
    lida: linha.lida === 1,
    criadoEm: new Date(linha.criadoEm),
    urgencia: linha.urgencia,
  }));
}

/** Total de notificações não lidas (de todos os tipos). */
export async function contarNaoLidas(): Promise<number> {
  const linhas = await db.select({ id: notificacoes.id }).from(notificacoes).where(eq(notificacoes.lida, 0));
  return linhas.length;
}

/** Marca como lida. Id inexistente não faz nada. */
export async function marcarNotificacaoLida(id: string): Promise<void> {
  await db.update(notificacoes).set({ lida: 1 }).where(eq(notificacoes.id, id));
}

export async function existeNotificacao(id: string): Promise<boolean> {
  const linhas = await db.select({ id: notificacoes.id }).from(notificacoes).where(eq(notificacoes.id, id));
  return linhas.length > 0;
}
