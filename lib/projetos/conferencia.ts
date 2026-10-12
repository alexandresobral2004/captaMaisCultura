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

export type SituacaoCriterio = 'atendido' | 'parcial' | 'ausente';
export interface CriterioConferido { criterio: string; situacao: SituacaoCriterio; observacao: string }

export interface ResultadoConferenciaProjeto {
  secoesExigidas: string[];
  secoesFaltando: string[];
  criterios: CriterioConferido[];
  avisos: string[];
  /** 0 a 100: atendido vale 1, parcial vale 0,5. 0 se não houve critérios. */
  nota: number;
}

export class ConferenciaErro extends Error {
  constructor(message: string, public status: number) { super(message); }
}

/** Percentual de critérios atendidos (parcial vale meio). */
export function calcularNota(criterios: CriterioConferido[]): number {
  if (!criterios.length) return 0;
  const pontos = criterios.reduce((s, c) => s + (c.situacao === 'atendido' ? 1 : c.situacao === 'parcial' ? 0.5 : 0), 0);
  return Math.round((pontos / criterios.length) * 100);
}

const listaDe = (valor: unknown): string[] => {
  if (Array.isArray(valor)) return valor.map(v => (typeof v === 'string' ? v : JSON.stringify(v)));
  if (typeof valor === 'string' && valor.trim()) return [valor];
  return [];
};

/** Confere o texto do projeto contra o edital. `julgar` recebe o prompt e devolve o JSON em texto (injetável). */
export async function conferirProjeto(
  projeto: any,
  julgar: (prompt: string) => Promise<string>,
): Promise<ResultadoConferenciaProjeto> {
  const edital = projeto.edital as any;
  const analise = edital?.analiseIA;
  if (!analise) throw new ConferenciaErro('O edital ainda não foi analisado. Analise o edital primeiro.', 400);

  const secoes: SecaoConferencia[] = ((projeto.secoesDinamicas as any[]) || []).map(s => ({
    titulo: s.titulo as string,
    texto: semHtml(s.conteudo),
  }));
  if (!secoes.some(s => s.texto)) throw new ConferenciaErro('O projeto ainda não tem texto. Escreva ou gere a proposta primeiro.', 400);

  const exigidas = listaDe(analise.secoesRequeridas);
  const avisos = avisosConferencia({
    valorSolicitado: Number(projeto.valorSolicitado || 0),
    valorMax: Number(edital.valorMax || 0),
    restritoA: analise.elegibilidade?.restritoA,
  });

  const criterios = listaDe(analise.criteriosAvaliacao);
  let conferidos: CriterioConferido[] = [];
  if (criterios.length) {
    const bruto = JSON.parse(await julgar(`Confira se o texto do projeto atende a cada critério de avaliação do edital. Use SOMENTE o que está escrito no texto; não presuma nada.
Para cada critério retorne: situacao ("atendido", "parcial" ou "ausente") e observacao (uma frase curta em português dizendo o que falta ou onde está atendido).

CRITÉRIOS:
${criterios.map((c, i) => `${i + 1}. ${c}`).join('\n')}

TEXTO DO PROJETO:
${secoes.map(s => `## ${s.titulo}\n${s.texto.slice(0, 3500)}`).join('\n\n')}

Responda só JSON: {"criterios":[{"situacao":"atendido","observacao":"..."}]} na mesma ordem dos critérios.`) || '{}');
    const itens: any[] = Array.isArray(bruto.criterios) ? bruto.criterios : [];
    conferidos = criterios.map((criterio, i) => ({
      criterio,
      situacao: ['atendido', 'parcial', 'ausente'].includes(itens[i]?.situacao) ? itens[i].situacao : 'parcial',
      observacao: String(itens[i]?.observacao || ''),
    }));
  }

  return {
    secoesExigidas: exigidas,
    secoesFaltando: secoesFaltando(exigidas, secoes),
    criterios: conferidos,
    avisos,
    nota: calcularNota(conferidos),
  };
}
