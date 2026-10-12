/**
 * Token de scripts/cron para rotas de varredura.
 * Compatível com edge runtime (sem imports de node).
 *
 * Em produção SCAN_TOKEN é obrigatório; o valor de desenvolvimento só vale fora dela.
 */
const TOKEN_DESENVOLVIMENTO = 'capta-mais-scan-token-dev-only';

export function obterScanToken(): string | null {
  const configurado = process.env.SCAN_TOKEN;
  if (configurado) return configurado;
  if (process.env.NODE_ENV === 'production') return null;
  return TOKEN_DESENVOLVIMENTO;
}

/** Comparação em tempo constante para strings. */
export function comparacaoSegura(a: string, b: string): boolean {
  const tamanho = Math.max(a.length, b.length);
  let diferenca = a.length ^ b.length;
  for (let i = 0; i < tamanho; i++) {
    diferenca |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diferenca === 0;
}

export function scanTokenValido(fornecido: string | null | undefined): boolean {
  const esperado = obterScanToken();
  if (!esperado || !fornecido) return false;
  return comparacaoSegura(fornecido, esperado);
}

/** Lê o token apenas de headers (Authorization: Bearer ou X-Scan-Token), nunca da URL. */
export function extrairScanTokenDosHeaders(headers: Headers): string | null {
  const auth = headers.get('Authorization');
  if (auth?.startsWith('Bearer ')) return auth.substring(7);
  return headers.get('X-Scan-Token');
}
