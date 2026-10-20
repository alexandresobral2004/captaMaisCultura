/**
 * Todos os cortes do funil de filtragem de editais em um só lugar.
 * Probabilidades em 0-1; certezas do Jev (escolha de eixo, relevância) em 0-100.
 */

function numeroDoAmbiente(nome: string, padrao: number): number {
  const valor = Number(process.env[nome]);
  return Number.isFinite(valor) && valor > 0 ? valor : padrao;
}

/** Triagem da listagem: abaixo desta certeza (0-100) o Jev não decide sozinho. */
export const jevConfiancaMinima = () => numeroDoAmbiente('JEV_CONFIANCA_MINIMA', 75);

/** Triagem da listagem: só descarta com certeza igual ou maior (0-100); abaixo disso vira dúvida. */
export const jevConfiancaDescarte = () => numeroDoAmbiente('JEV_CONFIANCA_DESCARTE', 90);

/** Região: probabilidade (0-1) de "restrito a outra região" a partir da qual rejeita. */
export const REGIAO_REJEITAR = 0.8;

/** Documento baixado: acima disto o Jev confirma que é edital; abaixo do segundo, descarta. */
export const DOCUMENTO_ACEITAR = 0.7;
export const DOCUMENTO_DESCARTAR = 0.25;

/** Documento baixado: com menos grupos de palavras que isto descarta sem consultar o Jev. */
export const DOCUMENTO_MINIMO_DE_GRUPOS = 2;
/** Documento baixado: sem Jev, com este número de grupos a regra aceita. */
export const DOCUMENTO_GRUPOS_SEM_JEV = 3;

/** Pontuação final: faixas de prioridade. */
export const SCORE_ALTO = 80;
export const SCORE_MEDIO = 60;

/**
 * Pontuação em camadas (lib/triagem/pontuacao.ts): notaFinal = PESO_REGEX × notaRegex + PESO_JEV × notaJev (0-100).
 * Acima de PONTUACAO_LIBERAR aceita; abaixo de PONTUACAO_BLOQUEAR descarta; entre as duas a OpenAI desempata
 * e, persistindo a incerteza, o edital vai para a Revisão Humana. Sem Jev, vale só a notaRegex.
 */
export const pesoRegex = () => numeroDoAmbiente('PONTUACAO_PESO_REGEX', 0.4);
export const pesoJev = () => numeroDoAmbiente('PONTUACAO_PESO_JEV', 0.6);
export const pontuacaoLiberar = () => numeroDoAmbiente('PONTUACAO_LIBERAR', 60);
export const pontuacaoBloquear = () => numeroDoAmbiente('PONTUACAO_BLOQUEAR', 25);
/** Com Jev, só libera se notaJev (p(chamada) × p(relevante) × 100) for ao menos esta: ele precisa achar mais provável que sim do que não. */
export const JEV_MINIMO_PARA_LIBERAR = 50;
