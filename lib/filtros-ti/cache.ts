const cacheValidacao = new Map<string, any>();
const CACHE_TTL = 24 * 60 * 60 * 1000;

export function gerarChaveCache(titulo: string, descricao: string): string {
  const str = `${titulo}|${descricao}`;
  return Buffer.from(str).toString('base64').substring(0, 32);
}

export function limparCache(): void {
  cacheValidacao.clear();
  console.log('Cache de validação TI limpo.');
}

export { cacheValidacao, CACHE_TTL };