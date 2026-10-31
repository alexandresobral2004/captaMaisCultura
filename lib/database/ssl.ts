// Decide o modo SSL da conexão PostgreSQL. Função pura: recebe a URL e as variáveis, sem I/O.
// Padrão: TLS obrigatório, exceto para localhost. DATABASE_SSL=disable desliga TLS em ambiente
// local (ex.: container Docker falando com um Postgres de desenvolvimento sem TLS).
export function opcaoSslPostgres(
  url: string,
  env: { DATABASE_SSL?: string }
): false | 'require' {
  if (env.DATABASE_SSL === 'disable') return false;
  const isLocalhost = url.includes('localhost') || url.includes('127.0.0.1');
  return isLocalhost ? false : 'require';
}
