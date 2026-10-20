/**
 * Busca de termos das listas (whitelist, blacklist, cultura) respeitando fronteira de palavra:
 * "moda" não casa em "modalidade", nem "api" em "capital". Aceita plural simples (s/es).
 */

const cache = new Map<string, RegExp>();

function regexDoTermo(termo: string): RegExp {
  let regex = cache.get(termo);
  if (!regex) {
    const escapado = termo.toLowerCase().replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&');
    regex = new RegExp(`(?<![\\p{L}\\p{N}])${escapado}(?:s|es)?(?![\\p{L}\\p{N}])`, 'gu');
    cache.set(termo, regex);
  }
  regex.lastIndex = 0;
  return regex;
}

/** Quantas vezes o termo aparece como palavra (ou frase) inteira. O texto deve vir em minúsculas. */
export function contarTermo(texto: string, termo: string): number {
  if (!texto || !termo) return 0;
  return texto.match(regexDoTermo(termo))?.length ?? 0;
}

/** True se o termo aparece como palavra (ou frase) inteira. O texto deve vir em minúsculas. */
export function contemTermo(texto: string, termo: string): boolean {
  if (!texto || !termo) return false;
  return regexDoTermo(termo).test(texto);
}
