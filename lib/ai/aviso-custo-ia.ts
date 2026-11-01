import { montarRelatorioCustos } from './relatorio-custos';
import { deveNotificarCustoMensal, inicioDoMesIso } from './alerta-custo';
import { existeNotificacao, salvarNotificacao } from '../database/repositories/notificacao.repository';

/**
 * Grava o aviso de custo do mês na central de notificações (tabela notificacoes), quando o
 * total passa do limite. Id = alerta-custo-ia-AAAA-MM: um aviso por mês, compartilhado entre
 * web e worker. Nunca lança erro.
 */
export async function avisarCustoMensalSeNecessario(agora: Date = new Date()): Promise<void> {
  try {
    const mes = inicioDoMesIso(agora).slice(0, 7);
    const id = `alerta-custo-ia-${mes}`;

    // Checa antes de agregar: depois do aviso, cada chamada de IA não relê o mês inteiro
    if (await existeNotificacao(id)) return;

    const { alerta } = await montarRelatorioCustos({
      desde: inicioDoMesIso(agora),
      ate: agora.toISOString(),
      agora,
    });
    if (!deveNotificarCustoMensal(alerta.totalUsd, alerta.limiteUsd, false)) return;

    await salvarNotificacao({
      id,
      tipo: 'alerta_custo_ia',
      titulo: 'Custo de IA acima do limite no mês',
      descricao: `Gasto de IA no mês: US$ ${alerta.totalUsd.toFixed(2)}. Limite: US$ ${alerta.limiteUsd.toFixed(2)}.`,
      quantidade: 1,
      link: '/configuracoes/custos-ia',
      lida: false,
      urgencia: 'alta',
      criadoEm: agora,
    });
  } catch (erro) {
    console.warn('[aviso-custo-ia] Falha ao avisar custo mensal:', erro instanceof Error ? erro.message : erro);
  }
}
