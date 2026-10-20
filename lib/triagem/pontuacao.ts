import fs from 'fs';
import path from 'path';
import { contemTermo } from '../scraper/filtros/termos';
import { loadWhitelist } from '../scraper/filtros/loaders';
import { analisarBlacklist } from '../scraper/filtros/blacklist-engine';
import { tituloInstitucional, GRUPOS_FORTES } from '../scraper/validacao-documento';
import { termosCulturaEncontrados, termosNaoEdital } from './cultura';
import { restritoAOutraRegiao } from './regiao';
import { pesoRegex, pesoJev, pontuacaoLiberar, pontuacaoBloquear, jevConfiancaDescarte, JEV_MINIMO_PARA_LIBERAR } from './limiares';
import type { Eixo } from '../filtros-ti/jev-classifier';

/**
 * Pontuação em camadas de expressões regulares (módulo puro, sem rede). Cada camada soma ou tira pontos
 * e explica o porquê em `achados`; as regras (termos, regex e pesos) ficam em data/filtros/pontuacao.json.
 *
 *   C1 chamada   o texto abre inscrição, e não é notícia, resultado ou item de menu
 *   C2 eixo      termos fortes do eixo (Cultura ou Pesquisa); genéricos só contam junto de um forte
 *   C3 região    abrangência Ceará/Nordeste/nacional; outro estado ou município é veto
 *   C4 documento (com o texto do PDF) grupos distintos de palavras de edital, com ao menos um forte
 *
 * A decisão (liberar, bloquear, zona cinzenta) é política deste arquivo; o Jev só entra com probabilidades.
 */

interface Regra {
  termo?: string;
  regex?: string;
  peso: number;
  rotulo?: string;
}

interface Regras {
  chamada: { maximo: number; positivos: Regra[]; negativos: Regra[]; institucional: number; excluir_cultura: number };
  eixo: {
    maximo: number;
    peso_forte: number;
    peso_generico: number;
    maximo_genericos: number;
    bonus_titulo: number;
    limite_blacklist: number;
    genericos: Record<Eixo, string[]>;
    extras: Record<Eixo, string[]>;
  };
  regiao: { maximo: number; peso_aberto: number; peso_neutro: number; peso_restrito: number; abertos: { termo: string }[] };
  documento: { maximo: number; peso_forte: number; peso_comum: number; sem_forte: number };
}

let regras: Regras | null = null;
const regexes = new Map<string, RegExp>();

function carregarRegras(): Regras {
  if (regras) return regras;
  const arquivo = path.join(process.cwd(), 'data', 'filtros', 'pontuacao.json');
  regras = JSON.parse(fs.readFileSync(arquivo, 'utf-8')) as Regras;
  return regras;
}

export function limparCachePontuacao(): void {
  regras = null;
  regexes.clear();
}

/** Texto das regras: o termo (palavra inteira) ou a expressão regular, em minúsculas. */
function casa(texto: string, regra: Regra): boolean {
  if (regra.termo) return contemTermo(texto, regra.termo.toLowerCase());
  if (!regra.regex) return false;
  let re = regexes.get(regra.regex);
  if (!re) {
    re = new RegExp(regra.regex, 'iu');
    regexes.set(regra.regex, re);
  }
  return re.test(texto);
}

const nomeDaRegra = (r: Regra) => r.rotulo ?? r.termo ?? r.regex ?? '?';
const limitar = (valor: number, maximo: number) => Math.max(-maximo, Math.min(maximo, valor));
const sinal = (n: number) => (n > 0 ? `+${n}` : `${n}`);

export interface Camada {
  pontos: number;
  /** Cada ponto ganho ou perdido com o termo que o causou, ex.: "edital +10". */
  achados: string[];
}

export interface EntradaPontuacao {
  titulo: string;
  descricao: string;
  orgao?: string;
  eixo: Eixo;
}

/** C1: parece uma chamada com inscrição. */
export function camadaChamada(entrada: EntradaPontuacao): Camada {
  const r = carregarRegras().chamada;
  const texto = `${entrada.titulo} ${entrada.descricao}`.toLowerCase();
  const achados: string[] = [];
  let pontos = 0;
  for (const regra of [...r.positivos, ...r.negativos]) {
    if (casa(texto, regra)) {
      pontos += regra.peso;
      achados.push(`${nomeDaRegra(regra)} ${sinal(regra.peso)}`);
    }
  }
  if (tituloInstitucional(entrada.titulo)) {
    pontos += r.institucional;
    achados.push(`item de menu ou página institucional ${sinal(r.institucional)}`);
  }
  if (entrada.eixo === 'Cultura') {
    for (const termo of termosNaoEdital(entrada.titulo, entrada.descricao)) {
      pontos += r.excluir_cultura;
      achados.push(`${termo} ${sinal(r.excluir_cultura)}`);
    }
  }
  return { pontos: limitar(pontos, r.maximo), achados };
}

/** Termos do eixo que valem pontos cheios: as listas de termos menos os genéricos daquele eixo. */
function termosDoEixo(entrada: EntradaPontuacao): { fortes: string[]; genericos: string[] } {
  const r = carregarRegras().eixo;
  const genericosDoEixo = new Set(r.genericos[entrada.eixo].map(t => t.toLowerCase()));
  const texto = `${entrada.titulo} ${entrada.descricao}`.toLowerCase();

  let achados: string[];
  let fracosDaLista: string[] = [];
  if (entrada.eixo === 'Cultura') {
    achados = [...termosCulturaEncontrados(entrada.titulo, entrada.descricao), ...r.extras.Cultura.filter(t => contemTermo(texto, t))];
  } else {
    const wl = loadWhitelist();
    achados = [...wl.tecnologia, ...wl.contexto_institucional, ...r.extras.Pesquisa].filter(t => contemTermo(texto, t));
    // contexto_geral (ciência, saúde, esporte…) é amplo demais para valer sozinho
    fracosDaLista = wl.contexto_geral.filter(t => contemTermo(texto, t));
  }
  const unicos = Array.from(new Set(achados.map(t => t.toLowerCase())));
  const genericos = Array.from(new Set([...unicos.filter(t => genericosDoEixo.has(t)), ...fracosDaLista.map(t => t.toLowerCase())]));
  return { fortes: unicos.filter(t => !genericosDoEixo.has(t) && !genericos.includes(t)), genericos };
}

export interface CamadaEixo extends Camada {
  /** Quantos termos fortes do eixo apareceram (sem nenhum, não há sinal temático). */
  fortes: number;
}

/** C2: sinal temático do eixo. */
export function camadaEixo(entrada: EntradaPontuacao): CamadaEixo {
  const r = carregarRegras().eixo;
  const { fortes, genericos } = termosDoEixo(entrada);
  const achados: string[] = [];
  let pontos = 0;

  for (const termo of fortes) {
    pontos += r.peso_forte;
    achados.push(`${termo} ${sinal(r.peso_forte)}`);
  }
  if (fortes.some(t => contemTermo(entrada.titulo.toLowerCase(), t))) {
    pontos += r.bonus_titulo;
    achados.push(`termo forte no título ${sinal(r.bonus_titulo)}`);
  }
  pontos = Math.min(pontos, r.maximo);

  if (fortes.length > 0) {
    // Genéricos (festival, evento, chamada…) só reforçam quando já há um termo forte
    const extra = Math.min(genericos.length * r.peso_generico, r.maximo_genericos);
    if (extra > 0) {
      pontos += extra;
      achados.push(`genéricos (${genericos.slice(0, 3).join(', ')}) ${sinal(extra)}`);
    }
  } else if (genericos.length > 0) {
    achados.push(`só genéricos (${genericos.slice(0, 3).join(', ')}): 0`);
  }

  if (entrada.eixo === 'Pesquisa') {
    const bl = analisarBlacklist(entrada.titulo, `${entrada.titulo} ${entrada.descricao}`);
    if (bl.scoreNegativo > 0) {
      const desconto = Math.min(bl.scoreNegativo, r.limite_blacklist);
      pontos -= desconto;
      achados.push(`blacklist de TI (${bl.termosEncontrados.slice(0, 3).map(t => t.termo).join(', ')}) -${desconto}`);
    }
  }
  return { pontos: limitar(pontos, r.maximo), achados, fortes: fortes.length };
}

export interface CamadaRegiao extends Camada {
  /** Restrição explícita a outro estado ou município: veto, independente da nota. */
  veto?: string;
}

/** C3: abrangência territorial. Município do Ceará segue restrito, como já era (ver regiao.ts). */
export function camadaRegiao(entrada: EntradaPontuacao): CamadaRegiao {
  const r = carregarRegras().regiao;
  const restricao = restritoAOutraRegiao(entrada);
  if (restricao.restrito) {
    const motivo = restricao.motivo ?? 'Restrito a outra região';
    return { pontos: r.peso_restrito, achados: [`${motivo} ${sinal(r.peso_restrito)}`], veto: motivo };
  }
  const texto = `${entrada.titulo} ${entrada.descricao} ${entrada.orgao ?? ''}`.toLowerCase();
  const aberto = r.abertos.find(a => contemTermo(texto, a.termo.toLowerCase()));
  if (aberto) return { pontos: r.peso_aberto, achados: [`${aberto.termo} ${sinal(r.peso_aberto)}`] };
  return { pontos: r.peso_neutro, achados: [`sem restrição territorial ${sinal(r.peso_neutro)}`] };
}

/** C4: grupos distintos de palavras de edital no documento baixado (nomes de GRUPOS em validacao-documento). */
export function camadaDocumento(grupos: string[]): Camada {
  const r = carregarRegras().documento;
  const achados: string[] = [];
  let pontos = 0;
  for (const g of grupos) {
    const forte = GRUPOS_FORTES.includes(g);
    const peso = forte ? r.peso_forte : r.peso_comum;
    pontos += peso;
    achados.push(`${g} ${sinal(peso)}`);
  }
  if (!grupos.some(g => GRUPOS_FORTES.includes(g))) {
    pontos += r.sem_forte;
    achados.push(`sem objeto nem inscrição ${sinal(r.sem_forte)}`);
  }
  return { pontos: limitar(pontos, r.maximo), achados };
}

export interface Pontuacao {
  chamada: Camada;
  eixo: CamadaEixo;
  regiao: CamadaRegiao;
  documento?: Camada;
  /** Soma das camadas normalizada para 0-100. */
  notaRegex: number;
  /** Violações graves independentes da nota. */
  vetos: string[];
}

/** Roda as camadas sobre o texto de um edital; `grupos` (C4) só existe depois do download do documento. */
export function pontuar(entrada: EntradaPontuacao, grupos?: string[]): Pontuacao {
  const regrasAtuais = carregarRegras();
  const chamada = camadaChamada(entrada);
  const eixo = camadaEixo(entrada);
  const regiao = camadaRegiao(entrada);
  const documento = grupos ? camadaDocumento(grupos) : undefined;

  const soma = chamada.pontos + eixo.pontos + regiao.pontos + (documento?.pontos ?? 0);
  const maximo = regrasAtuais.chamada.maximo + regrasAtuais.eixo.maximo + regrasAtuais.regiao.maximo + (documento ? regrasAtuais.documento.maximo : 0);
  const notaRegex = Math.max(0, Math.min(100, Math.round((soma / maximo) * 100)));
  return { chamada, eixo, regiao, documento, notaRegex, vetos: regiao.veto ? [regiao.veto] : [] };
}

export type Faixa = 'liberar' | 'cinza' | 'bloquear';

export interface Nota {
  notaRegex: number;
  /** p(é chamada) × p(relevante do eixo) × 100; null sem Jev. */
  notaJev: number | null;
  notaFinal: number;
  faixa: Faixa;
}

/** Nota do Jev a partir das duas probabilidades que ele já devolve na consulta única. */
export function notaDoJev(pChamada: number, pRelevante: number): number {
  return Math.round(pChamada * pRelevante * 100);
}

/**
 * Composição da nota final e da faixa:
 *  - notaFinal = média ponderada de notaRegex e notaJev (sem Jev, só a notaRegex);
 *  - liberar: nota alta e, havendo Jev, ele também acha mais provável que sim do que não;
 *  - bloquear: nota baixa e, havendo Jev, ele também tem certeza de que não serve (nunca por incerteza);
 *  - o resto é zona cinzenta (OpenAI desempata; persistindo a dúvida, Revisão Humana).
 */
export function comporNota(notaRegex: number, notaJev: number | null): Nota {
  const pr = pesoRegex();
  const pj = pesoJev();
  const notaFinal = notaJev === null ? notaRegex : Math.round((pr * notaRegex + pj * notaJev) / (pr + pj));

  let faixa: Faixa = 'cinza';
  if (notaFinal >= pontuacaoLiberar() && (notaJev === null || notaJev >= JEV_MINIMO_PARA_LIBERAR)) {
    faixa = 'liberar';
  } else if (notaFinal <= pontuacaoBloquear() && (notaJev === null || notaJev <= 100 - jevConfiancaDescarte())) {
    faixa = 'bloquear';
  }
  return { notaRegex, notaJev, notaFinal, faixa };
}

/** Uma linha para o motivo da decisão: notas e o que cada camada achou. */
export function descreverPontuacao(p: Pontuacao, n: Nota): string {
  const camada = (nome: string, c: Camada) => `${nome} ${sinal(c.pontos)} [${c.achados.join('; ') || 'nada'}]`;
  const partes = [
    camada('C1 chamada', p.chamada),
    camada('C2 eixo', p.eixo),
    camada('C3 região', p.regiao),
    ...(p.documento ? [camada('C4 documento', p.documento)] : []),
  ];
  const jev = n.notaJev === null ? 'sem Jev' : `Jev ${n.notaJev}`;
  return `Nota ${n.notaFinal} (regex ${n.notaRegex}, ${jev}): ${partes.join(' | ')}`;
}
