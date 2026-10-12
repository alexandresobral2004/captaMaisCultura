/**
 * Exibe uma data no padrão brasileiro (dd/mm/aaaa).
 * Aceita aaaa-mm-dd, data com hora (ISO) e dd/mm/aaaa. Texto sem data (ex.: "A consultar") volta como está.
 */
export function formatarDataBr(valor?: string | null): string {
  if (!valor) return 'A consultar';
  const texto = valor.trim();
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const br = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) return `${br[1].padStart(2, '0')}/${br[2].padStart(2, '0')}/${br[3]}`;
  return texto;
}
