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

/** Fração do teto reservada à análise (PDF + IA). A triagem para antes dessa parcela. */
export const FRACAO_RESERVA_ANALISE = 1 / 3;

type Fase = 'triagem' | 'analise';

// Estado da varredura em andamento. Só existe entre iniciar e encerrar; fora disso não há limite.
let ativo: { inicio: number; limites: LimitesVarredura; chamadas: number; pendentes: number; agora: () => number; fase: Fase } | null = null;

export function iniciarOrcamentoVarredura(
  inicio: number,
  limites: LimitesVarredura = { prazoMs: PRAZO_VARREDURA_MS, maxChamadas: MAX_CHAMADAS_IA_VARREDURA },
  agora: () => number = () => Date.now(),
): void {
  ativo = { inicio, limites, chamadas: 0, pendentes: 0, agora, fase: 'triagem' };
}

/** Marca o início da análise: a partir daqui a parcela reservada também pode ser usada. */
export function iniciarFaseAnalise(): void {
  if (ativo) ativo.fase = 'analise';
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
  const teto = ativo.limites.maxChamadas;
  const reserva = Math.floor(teto * FRACAO_RESERVA_ANALISE);
  return motivoParada({
    inicio: ativo.inicio,
    agora: ativo.agora(),
    prazoMs: ativo.limites.prazoMs,
    chamadas: ativo.chamadas,
    maxChamadas: ativo.fase === 'triagem' ? teto - reserva : teto,
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
