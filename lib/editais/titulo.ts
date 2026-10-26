/** Palavras que costumam aparecer na linha do título de uma chamada ou edital. */
const PALAVRAS_TITULO = /chamada|edital|programa|auxílio|auxilio|prêmio|premio|bolsa|convocat|fomento|concurso/i;

/** Remove marcação Markdown (cabeçalhos, negrito, itálico, links) e normaliza espaços. */
function limparMarkdown(linha: string): string {
  return linha
    .replace(/^#+\s*/, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Título de um edital a partir do texto extraído do PDF (pdf-parse ou LlamaParse/Markdown).
 * Começa na primeira linha que parece título (ex.: "Chamada ...") e junta as linhas seguintes
 * até cerca de 90 caracteres, porque o título costuma quebrar em duas ou três linhas.
 */
export function extrairTituloDoTexto(texto: string, limite = 200): string {
  const linhas = texto
    .split(/\r?\n/)
    .map(limparMarkdown)
    .filter((linha) => linha.length >= 3)
    .slice(0, 40);

  if (linhas.length === 0) return '';

  const inicio = Math.max(0, linhas.findIndex((linha) => PALAVRAS_TITULO.test(linha)));

  const partes: string[] = [];
  let tamanho = 0;
  for (const linha of linhas.slice(inicio, inicio + 4)) {
    partes.push(linha);
    tamanho += linha.length;
    if (tamanho >= 90) break;
  }

  return partes.join(' ').substring(0, limite);
}
