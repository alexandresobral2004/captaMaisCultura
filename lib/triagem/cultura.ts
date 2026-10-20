import fs from 'fs';
import path from 'path';
import { contemTermo } from '../scraper/filtros/termos';

interface ListasCultura {
  termos: string[];
  excluir: string[];
}

let cache: ListasCultura | null = null;

function carregar(): ListasCultura {
  if (cache) return cache;
  const arquivo = path.join(process.cwd(), 'data', 'filtros', 'cultura.json');
  const bruto = JSON.parse(fs.readFileSync(arquivo, 'utf-8'));
  cache = {
    termos: Array.isArray(bruto.termos) ? bruto.termos : [],
    excluir: Array.isArray(bruto.excluir) ? bruto.excluir : [],
  };
  return cache;
}

/** Termos de cultura presentes no texto (usado como pré-filtro e como alternativa sem IA). */
export function termosCulturaEncontrados(titulo: string, descricao: string): string[] {
  const texto = `${titulo} ${descricao}`.toLowerCase();
  return carregar().termos.filter((t) => contemTermo(texto, t));
}

/** Termos de "não é edital" (notícia, resultado etc.) presentes no texto. */
export function termosNaoEdital(titulo: string, descricao: string): string[] {
  const texto = `${titulo} ${descricao}`.toLowerCase();
  return carregar().excluir.filter((t) => contemTermo(texto, t));
}

/** True se o texto parece conteúdo que não é edital (notícia, resultado etc.). */
export function pareceNaoEdital(titulo: string, descricao: string): boolean {
  return termosNaoEdital(titulo, descricao).length > 0;
}

export function limparCacheCultura(): void {
  cache = null;
}
