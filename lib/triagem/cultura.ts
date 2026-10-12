import fs from 'fs';
import path from 'path';

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
  return carregar().termos.filter((t) => texto.includes(t.toLowerCase()));
}

/** True se o texto parece conteúdo que não é edital (notícia, resultado etc.). */
export function pareceNaoEdital(titulo: string, descricao: string): boolean {
  const texto = `${titulo} ${descricao}`.toLowerCase();
  return carregar().excluir.some((t) => texto.includes(t.toLowerCase()));
}

export function limparCacheCultura(): void {
  cache = null;
}
