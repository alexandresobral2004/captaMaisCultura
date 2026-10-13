import { consultarJev, jevDisponivel } from '../ai/jev';

/** Páginas de menu e de institucional que aparecem nas listagens dos portais e não são editais. */
const TITULO_INSTITUCIONAL = /\b(diretoria|presid[êe]ncia|ouvidoria|categorias|prote[çc][ãa]o de dados|treinamentos?|participa[çc][ãa]o social|manual|guias?|tutoriais?|galeria|agendamento|pain[eé]is?|todas as parcerias|programas estrat[ée]gicos|compartilhamento|presta[çc][ãa]o de contas|dados da administra[çc][ãa]o|saiba mais sobre|acesso [àa] informa[çc][ãa]o|pol[íi]tica de privacidade|mapa do site)\b/i;

/** Regra 1: o título (ou o endereço) parece um item de menu e não um edital. */
export function tituloInstitucional(titulo: string, link = ''): boolean {
  return TITULO_INSTITUCIONAL.test(titulo) && !/\b(edital|chamada)\b.{0,6}n[ºo°]?\s*\d+/i.test(titulo) && !/\.pdf(\?|$)/i.test(link);
}

/** Grupos de palavras que um edital de verdade costuma ter. Cada grupo conta uma vez. */
const GRUPOS: Record<string, RegExp> = {
  identificacao: /\bedital\b|chamada p[úu]blica|chamamento p[úu]blico|chamada\s+(\w+\s+)?n[ºo°]\s*\d+/i,
  objeto: /\bdo objeto\b|\bobjeto\b|objetivos? d[aoe]s? (chamada|edital|programa)/i,
  inscricao: /inscri[cç][õo]es?|submiss[ãa]o de propostas|envio de propostas|apresenta[cç][ãa]o de propostas/i,
  prazo: /\bprazos?\b|cronograma|data limite|per[íi]odo de inscri/i,
  elegibilidade: /elegibilidade|requisitos? (para|de) participa|podem participar|proponentes?|quem pode/i,
  recursos: /recursos financeiros|valor (m[áa]ximo|total|global)|dota[cç][ãa]o or[çc]ament[aá]ria|itens financi[áa]veis|R\$\s*[\d.]+/i,
  selecao: /crit[ée]rios? de (sele[cç][ãa]o|avalia[cç][ãa]o|julgamento)|julgamento (das|de) propostas|an[áa]lise de m[ée]rito/i,
  finais: /disposi[cç][õo]es finais|impugna[cç][ãa]o|recursos administrativos|resultado final/i,
};

/** Com menos grupos que isto o documento é descartado sem consultar o Jev. */
export const MINIMO_DE_GRUPOS = 2;
/** Com este número de grupos, sem Jev, o documento é aceito pela regra. */
export const GRUPOS_PARA_ACEITAR_SEM_JEV = 3;

export interface SinaisDeEdital {
  /** Grupos presentes e a palavra que casou em cada um. */
  termos: { grupo: string; palavra: string }[];
  /** Pequenos trechos do documento ao redor das palavras, para o Jev decidir. */
  trechos: string[];
}

/** Procura no texto as palavras típicas de edital e guarda um trecho curto de cada. */
export function buscarSinaisDeEdital(texto: string, tamanhoTrecho = 90): SinaisDeEdital {
  const limpo = (texto || '').replace(/\s+/g, ' ');
  const termos: SinaisDeEdital['termos'] = [];
  const trechos: string[] = [];
  for (const [grupo, regex] of Object.entries(GRUPOS)) {
    const m = regex.exec(limpo);
    if (!m) continue;
    termos.push({ grupo, palavra: m[0].trim() });
    const ini = Math.max(0, m.index - tamanhoTrecho);
    const fim = Math.min(limpo.length, m.index + m[0].length + tamanhoTrecho);
    trechos.push(`${ini > 0 ? '…' : ''}${limpo.slice(ini, fim).trim()}${fim < limpo.length ? '…' : ''}`);
  }
  return { termos, trechos };
}

export interface ResultadoValidacao {
  /** valido: segue para análise; duvida: uma pessoa revisa; descartado: não é edital. */
  decisao: 'valido' | 'duvida' | 'descartado';
  /** 'regra' = decidido pelas palavras; 'jev' = decidido pelo Jev. */
  etapa: 'regra' | 'jev';
  motivo: string;
  termos: string[];
  /** Probabilidade de ser edital segundo o Jev, quando consultado. */
  probabilidade?: number;
}

export type JulgarEdital = (entrada: { titulo: string; orgao: string; termos: string[]; trechos: string[] }) => Promise<number>;

/** Pergunta ao Jev, com as palavras e os trechos encontrados, se o documento é mesmo um edital. */
export const julgarComJev: JulgarEdital = async (entrada) => {
  const { answers } = await consultarJev(entrada, {
    edital: {
      type: 'noul',
      instructions:
        'O documento é um edital, chamada pública ou chamamento que abre inscrições para quem quer submeter uma proposta, projeto ou candidatura, com regras de participação? Use o título, as palavras encontradas e os trechos.',
      criteria: {
        true: 'Define objeto, quem pode participar, prazo ou forma de inscrição e regras de seleção de propostas.',
        false: 'É manual, guia, notícia, resultado, página institucional, relatório ou outro texto que não abre inscrições.',
      },
    },
  });
  return answers.edital.noul;
};

/** Aceita acima deste valor; descarta só abaixo do segundo; entre os dois vai para revisão. */
export const CORTE_ACEITAR = 0.7;
export const CORTE_DESCARTAR = 0.25;

/**
 * Segunda etapa da triagem: valida o texto de um documento já baixado.
 * 1) Regra: precisa ter palavras de pelo menos MINIMO_DE_GRUPOS grupos.
 * 2) Jev: recebe título, palavras e trechos e decide, com três saídas (válido, dúvida, descartado).
 *    Sem Jev, vale só a regra: muitos grupos aceita, poucos vai para revisão.
 */
export async function validarDocumentoEdital(
  doc: { titulo: string; orgao: string; texto: string },
  julgar: JulgarEdital | null = jevDisponivel() ? julgarComJev : null
): Promise<ResultadoValidacao> {
  const { termos, trechos } = buscarSinaisDeEdital(doc.texto);
  const palavras = termos.map(t => t.palavra);

  if (termos.length < MINIMO_DE_GRUPOS) {
    return {
      decisao: 'descartado',
      etapa: 'regra',
      motivo: `Quase nenhuma palavra de edital no documento (${termos.length} grupo${termos.length === 1 ? '' : 's'} de palavras)`,
      termos: palavras,
    };
  }

  const pelaRegra = (aviso: string): ResultadoValidacao => ({
    decisao: termos.length >= GRUPOS_PARA_ACEITAR_SEM_JEV ? 'valido' : 'duvida',
    etapa: 'regra',
    motivo: `${termos.length} grupos de palavras de edital (${aviso})`,
    termos: palavras,
  });
  if (!julgar) return pelaRegra('Jev indisponível');

  try {
    const probabilidade = await julgar({ titulo: doc.titulo, orgao: doc.orgao, termos: palavras, trechos });
    const pct = Math.round(probabilidade * 100);
    const decisao = probabilidade >= CORTE_ACEITAR ? 'valido' : probabilidade <= CORTE_DESCARTAR ? 'descartado' : 'duvida';
    return {
      decisao,
      etapa: 'jev',
      probabilidade,
      motivo:
        decisao === 'valido' ? `Jev confirmou que é edital (${pct}%)`
        : decisao === 'descartado' ? `Jev indicou que não é edital (${pct}%)`
        : `Jev ficou em dúvida se é edital (${pct}%)`,
      termos: palavras,
    };
  } catch {
    return pelaRegra('Jev não respondeu');
  }
}
