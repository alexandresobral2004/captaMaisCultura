/** Prazo total de uma varredura semanal, em milissegundos. */
export const PRAZO_VARREDURA_MS = 20 * 60 * 1000;

/** Teto de chamadas à IA (Jev e OpenAI) por varredura. Estimativa de 2026-11-08: ~400 triagens por semana. */
export const MAX_CHAMADAS_IA_VARREDURA = 300;

export type MotivoParada = 'prazo' | 'limite_ia';

export interface LimitesVarredura {
  prazoMs: number;
  maxChamadas: number;
}

/** Decide se a varredura deve parar. Função pura: recebe o estado, não lê relógio nem banco. */
export function motivoParada(estado: {
  inicio: number;
  agora: number;
  prazoMs: number;
  chamadas: number;
  maxChamadas: number;
}): MotivoParada | null {
  if (estado.agora - estado.inicio >= estado.prazoMs) return 'prazo';
  if (estado.chamadas >= estado.maxChamadas) return 'limite_ia';
  return null;
}

// Estado da varredura em andamento. Só existe entre iniciar e encerrar; fora disso não há limite.
let ativo: { inicio: number; limites: LimitesVarredura; chamadas: number; pendentes: number; agora: () => number } | null = null;

export function iniciarOrcamentoVarredura(
  inicio: number,
  limites: LimitesVarredura = { prazoMs: PRAZO_VARREDURA_MS, maxChamadas: MAX_CHAMADAS_IA_VARREDURA },
  agora: () => number = () => Date.now(),
): void {
  ativo = { inicio, limites, chamadas: 0, pendentes: 0, agora };
}

/** Candidato que não foi triado por falta de orçamento: não é salvo e fica para a próxima varredura. */
export function registrarPendente(): void {
  if (ativo) ativo.pendentes++;
}

/** Quantos candidatos a varredura atual deixou para a próxima. */
export function pendentesDoOrcamento(): number {
  return ativo?.pendentes ?? 0;
}

export function encerrarOrcamentoVarredura(): void {
  ativo = null;
}

/** Retorna o motivo que impede nova chamada, ou null se ainda há orçamento. Sem varredura ativa, nunca impede. */
export function orcamentoVarreduraEsgotado(): MotivoParada | null {
  if (!ativo) return null;
  return motivoParada({
    inicio: ativo.inicio,
    agora: ativo.agora(),
    prazoMs: ativo.limites.prazoMs,
    chamadas: ativo.chamadas,
    maxChamadas: ativo.limites.maxChamadas,
  });
}

/** Reserva uma chamada à IA. Retorna false (sem chamar a IA) quando o orçamento da varredura acabou. */
export function reservarChamadaIA(): boolean {
  if (orcamentoVarreduraEsgotado() !== null) return false;
  if (ativo) ativo.chamadas++;
  return true;
}

/** Se o prazo da varredura já venceu. Usar antes de qualquer requisição HTTP aos portais. */
export function prazoVarreduraEsgotado(): boolean {
  return orcamentoVarreduraEsgotado() === 'prazo';
}
