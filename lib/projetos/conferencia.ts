export interface SecaoConferencia {
  titulo: string;
  texto: string;
}

export const semHtml = (t: string) => (t || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const normalizar = (t: string) =>
  t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/** Seções que o edital exige e que não têm texto no projeto. */
export function secoesFaltando(exigidas: string[], secoes: SecaoConferencia[]): string[] {
  return exigidas.filter(ex => {
    const n = normalizar(ex);
    return !secoes.some(s => {
      const t = normalizar(s.titulo);
      return s.texto.length > 40 && (t.includes(n) || n.includes(t));
    });
  });
}

/** Avisos de valor acima do teto e de participação restrita. */
export function avisosConferencia(opts: { valorSolicitado?: number; valorMax?: number; restritoA?: string | null }): string[] {
  const avisos: string[] = [];
  const teto = Number(opts.valorMax || 0);
  const solicitado = Number(opts.valorSolicitado || 0);
  if (teto && solicitado > teto) {
    avisos.push(`O valor solicitado (R$ ${solicitado.toLocaleString('pt-BR')}) passa do teto do edital (R$ ${teto.toLocaleString('pt-BR')}).`);
  }
  if (opts.restritoA) {
    avisos.push(`Este edital tem participação restrita: ${opts.restritoA}. Confirme que o proponente se enquadra.`);
  }
  return avisos;
}
