/** Limite padrão do alerta de custo de IA no mês, em USD. */
const LIMITE_PADRAO_USD = 15;

export interface StatusAlerta {
  ultrapassou: boolean;
  totalUsd: number;
  limiteUsd: number;
}

/** Compara o gasto com o limite. Função pura. */
export function avaliarAlerta(totalUsd: number, limiteUsd: number): StatusAlerta {
  return { ultrapassou: totalUsd > limiteUsd, totalUsd, limiteUsd };
}

/** Decide se o aviso de custo deve ser criado: passou do limite e o mês ainda não foi avisado. Função pura. */
export function deveNotificarCustoMensal(totalUsd: number, limiteUsd: number, jaAvisadoNoMes: boolean): boolean {
  return avaliarAlerta(totalUsd, limiteUsd).ultrapassou && !jaAvisadoNoMes;
}

/** Lê CUSTO_IA_ALERTA_USD; valor ausente, inválido ou negativo cai no padrão de US$ 15. */
export function limiteAlertaUsd(ambiente: Record<string, string | undefined> = process.env): number {
  const bruto = ambiente.CUSTO_IA_ALERTA_USD;
  if (bruto === undefined || bruto.trim() === '') return LIMITE_PADRAO_USD;
  const valor = Number(bruto);
  return Number.isFinite(valor) && valor >= 0 ? valor : LIMITE_PADRAO_USD;
}

/** Início do mês corrente em UTC (dia 1, 00:00), em ISO. */
export function inicioDoMesIso(agora: Date = new Date()): string {
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1)).toISOString();
}
