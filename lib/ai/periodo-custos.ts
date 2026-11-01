/**
 * Confere o período do painel de custos (datas no formato AAAA-MM-DD). Função pura: sem I/O.
 * Devolve a mensagem de erro, ou null quando o período serve.
 */
export function mensagemPeriodoInvalido(desde: string, ate: string): string | null {
  // Datas no formato AAAA-MM-DD ordenam como texto; campo vazio fica para o `required` do formulário
  if (desde && ate && desde > ate) return 'A data inicial não pode ser depois da data final.';
  return null;
}
