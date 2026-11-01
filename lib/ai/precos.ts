/**
 * Preços por 1M de tokens em USD. Função pura: sem I/O.
 * gpt-4o-mini e gpt-4o: tabela da OpenAI (padrões de OPENAI_MODEL e OPENAI_MODEL_FULL).
 * gpt-5.6-luna: OPENAI_MODEL_REDACAO. Jev: fonte secundária (ver docs/14-plano-melhorias),
 * saída gratuita; conferir na TypeSafe antes de confiar no alerta.
 */
interface Preco {
  entradaPorMilhao: number;
  saidaPorMilhao: number;
}

const PRECOS: Record<string, Preco> = {
  'gpt-4o-mini': { entradaPorMilhao: 0.15, saidaPorMilhao: 0.6 },
  'gpt-4o': { entradaPorMilhao: 2.5, saidaPorMilhao: 10 },
  'gpt-5.6-luna': { entradaPorMilhao: 0.2, saidaPorMilhao: 1.2 },
  jev: { entradaPorMilhao: 0.042, saidaPorMilhao: 0 },
  // Nome padrão do modelo do Jev (JEV_MODEL): mesmo preço
  'jev-latest': { entradaPorMilhao: 0.042, saidaPorMilhao: 0 },
};

/** Custo em USD. Devolve null quando o modelo não tem preço cadastrado (não é zero). */
export function custoUsd(modelo: string, tokensEntrada: number, tokensSaida: number): number | null {
  // A OpenAI devolve o snapshot com data (ex.: gpt-4o-mini-2024-07-18); cobra pelo mesmo preço
  // O Jev responde com versão (ex.: jev-1.0.0): todas as versões do Jev cobram o mesmo
  const preco = PRECOS[modelo] ?? PRECOS[modelo.replace(/-\d{4}-\d{2}-\d{2}$/, '')] ?? (modelo.startsWith('jev-') ? PRECOS['jev-latest'] : undefined);
  if (!preco) return null;
  return (tokensEntrada * preco.entradaPorMilhao + tokensSaida * preco.saidaPorMilhao) / 1_000_000;
}
