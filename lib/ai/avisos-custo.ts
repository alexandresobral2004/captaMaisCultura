import { eq } from 'drizzle-orm';
import { db } from '../database/db';
import { avisosCusto } from '../database/schema';

/** Prefixo do id do aviso na central: alerta-custo-ia-AAAA-MM. */
export const PREFIXO_AVISO_CUSTO = 'alerta-custo-ia-';

export interface AvisoCustoNotificacao {
  id: string;
  tipo: 'alerta_custo_ia';
  titulo: string;
  descricao: string;
  quantidade: number;
  link: string;
  lida: boolean;
  criadoEm: Date;
  urgencia: 'alta';
}

/** Avisos de custo guardados no banco, no formato da central de notificações. */
export async function avisosCustoComoNotificacao(): Promise<AvisoCustoNotificacao[]> {
  const linhas = await db.select().from(avisosCusto);
  return linhas.map((linha: typeof linhas[number]) => ({
    id: `${PREFIXO_AVISO_CUSTO}${linha.mes}`,
    tipo: 'alerta_custo_ia',
    titulo: 'Custo de IA acima do limite no mês',
    descricao: `Gasto de IA no mês: US$ ${linha.totalUsd.toFixed(2)}. Limite: US$ ${linha.limiteUsd.toFixed(2)}.`,
    quantidade: 1,
    link: '/configuracoes/custos-ia',
    lida: linha.lida === 1,
    criadoEm: new Date(linha.criadoEm),
    urgencia: 'alta',
  }));
}

/** Marca o aviso do mês como lido. Ids de outros tipos são ignorados. */
export async function marcarAvisoCustoLido(id: string): Promise<void> {
  if (!id.startsWith(PREFIXO_AVISO_CUSTO)) return;
  const mes = id.slice(PREFIXO_AVISO_CUSTO.length);
  await db.update(avisosCusto).set({ lida: 1 }).where(eq(avisosCusto.mes, mes));
}
