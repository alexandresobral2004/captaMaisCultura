/**
 * Caminhos de notícia, comunicado ou listagem de notícias em portais gov.br.
 * Um link desses aponta para uma matéria sobre o edital, não para o edital.
 */
const CAMINHO_DE_NOTICIA = /\/(noticias?|comunicados?|imprensa)(\/|$|\?|#)/i;

/** True quando o link é de notícia ou comunicado, e não de uma página de edital. */
export function linkEhPaginaDeNoticia(link: string): boolean {
  return CAMINHO_DE_NOTICIA.test(link);
}
