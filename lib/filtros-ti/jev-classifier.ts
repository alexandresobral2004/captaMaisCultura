import { consultarJev, jevDisponivel, obterModeloJev, JevError, type PerguntaJev } from '../ai/jev';
import { normalizarTecnologia, normalizarTipo, type AiClassificationResult } from './openai-classifier';

/** Categorias e tipos aceitos: os mesmos do classificador OpenAI (normalizados depois). */
export const TECNOLOGIAS_JEV = [
  'IA & Machine Learning', 'Big Data & Analytics', 'Cloud Computing', 'Segurança & Criptografia',
  'DevOps & Infraestrutura', 'Web & Mobile', 'Blockchain & Web3', 'Computação Quântica',
  'IoT & Sistemas Embarcados', 'Data Science', 'Linguagens & Compiladores', 'Pesquisa Acadêmica',
  'Desenvolvimento de Soluções', 'Inovação Tecnológica', 'Educação Digital', 'Transformação Digital',
  'Evento Científico', 'Outro - TI Geral',
] as const;

export const TIPOS_JEV = [
  'Framework', 'Linguagem de Programação', 'Banco de Dados', 'IDE/Editor', 'Plataforma',
  'Biblioteca/Pacote', 'Ferramenta de Desenvolvimento', 'Solução Corporativa', 'Sistema Educacional', 'Outro',
] as const;

/** Os dois eixos do sistema. 'Pesquisa' é o eixo de TI e pesquisa. */
export type Eixo = 'Cultura' | 'Pesquisa';

/** Abaixo desta certeza (0-100) o Jev não decide sozinho e o caso sobe para a OpenAI/revisão. */
export function confiancaMinimaJev(): number {
  return jevConfiancaMinima();
}

/**
 * Só descarta quando o Jev tem certeza igual ou maior que esta (0-100). Entre a confiança mínima
 * e este valor o edital vai para revisão ("dúvida"), em vez de ser rejeitado.
 */
export function confiancaParaDescartar(): number {
  return jevConfiancaDescarte();
}

import { jevConfiancaMinima, jevConfiancaDescarte } from '../triagem/limiares';

const PERGUNTAS = {
  eixo: {
    type: 'choice',
    instructions: 'A qual eixo temático pertence esta oportunidade (edital, chamada, evento)?',
    criteria: {
      Cultura:
        'Artes, patrimônio cultural, música, teatro, dança, audiovisual, literatura, cultura popular, museus, bibliotecas, economia criativa e fomento cultural (ex.: Lei Aldir Blanc, Lei Paulo Gustavo)',
      Pesquisa:
        'Tecnologia da informação, software, pesquisa científica e acadêmica, inovação tecnológica, P&D, universidades, institutos federais e eventos científicos',
      Fora:
        'Nenhum dos dois: esporte, saúde, agricultura, assistência social, infraestrutura, notícias, cursos ou conteúdo sem processo seletivo',
    },
  },
  eh_chamada: {
    type: 'noul',
    instructions:
      'O texto descreve uma chamada pública, edital, seleção, bolsa, fomento ou evento com inscrição/submissão de propostas?',
    criteria: {
      true: 'Oferece oportunidade com processo de inscrição, submissão ou seleção (edital, chamada, fomento, congresso com submissão)',
      false: 'Notícia, resultado final, blog, curso, tutorial, página institucional, item de menu ou seção de site (ex.: Governança, Corregedoria, Dados Abertos, Servidores, Perguntas Frequentes) ou conteúdo sem processo seletivo',
    },
  },
  relevante_ti: {
    type: 'noul',
    instructions:
      'A oportunidade é relevante para TI, software, pesquisa científica e acadêmica, universidades, institutos federais, inovação tecnológica ou eventos científicos em ciência, tecnologia e inovação?',
  },
  relevante_cultura: {
    type: 'noul',
    instructions:
      'A oportunidade é relevante para a área cultural (artes, patrimônio, música, audiovisual, literatura, cultura popular, economia criativa, fomento à cultura)?',
  },
  grau_relevancia: {
    type: 'score',
    instructions: 'Qual o grau de relevância para pesquisa, tecnologia e inovação em instituições acadêmicas?',
    criteria: [
      'Sem relação com tecnologia, pesquisa ou academia',
      'Relação distante ou genérica (menciona o tema de passagem)',
      'Relacionada, mas o foco principal é outro',
      'Foco claro em pesquisa, tecnologia ou inovação',
      'Foco central e específico em pesquisa/TI para universidades ou institutos',
    ],
  },
  restrito_a_outra_regiao: {
    type: 'noul',
    instructions:
      'Quem mora ou atua no estado do Ceará fica impedido de participar porque a oportunidade é restrita a um município ou a outro estado?',
    criteria: {
      true: 'Só aceita proponentes, moradores ou projetos de um município específico ou de um estado diferente do Ceará (ex.: edital municipal de outra cidade, fundação estadual de outro estado)',
      false: 'Aberta a todo o Brasil, ao Nordeste, ao Ceará, ou a qualquer proponente brasileiro; ou sem restrição territorial indicada',
    },
  },
  tecnologia: {
    type: 'choice',
    instructions: 'Em qual área tecnológica ou temática a oportunidade se enquadra melhor?',
    criteria: Object.fromEntries(TECNOLOGIAS_JEV.map((t) => [t, null])),
  },
  tipo: {
    type: 'choice',
    instructions: 'Que tipo de solução ou ferramenta a oportunidade visa financiar ou reunir?',
    criteria: Object.fromEntries(TIPOS_JEV.map((t) => [t, null])),
  },
} satisfies Record<string, PerguntaJev>;

const certeza = (p: number) => Math.max(p, 1 - p) * 100;

export interface EntradaEdital {
  titulo: string;
  descricao: string;
  valor?: string;
  orgao?: string;
  termosBranco?: string[];
  /** Termos da blacklist de TI que apareceram: só informação para o Jev, nunca motivo de rejeição. */
  termosSuspeitos?: string[];
  tipoEdital?: string;
}

export type RespostasEdital = Awaited<ReturnType<typeof consultarJev<typeof PERGUNTAS>>>['answers'];

/**
 * Uma única consulta ao Jev com todas as perguntas independentes (rodam em paralelo);
 * o código consome só as respostas do eixo aplicável. Null se indisponível ou com falha.
 */
export async function julgarEditalComJev(entrada: EntradaEdital): Promise<RespostasEdital | null> {
  if (!jevDisponivel()) return null;

  try {
    const { answers } = await consultarJev(
      {
        titulo: entrada.titulo,
        descricao: entrada.descricao.substring(0, 3000),
        valor: entrada.valor || null,
        orgao: entrada.orgao || null,
        palavras_chave: entrada.termosBranco ?? [],
        termos_suspeitos: entrada.termosSuspeitos ?? [],
        tipo_edital: entrada.tipoEdital ?? null,
      },
      PERGUNTAS
    );
    return answers;
  } catch (erro) {
    const msg = erro instanceof JevError ? erro.message : (erro as Error).message;
    console.warn(`   Jev indisponível (${msg}); seguindo para o classificador alternativo.`);
    return null;
  }
}

/** Eixo decidido pelo Jev, com a certeza (0-100) da escolha. */
export function eixoDasRespostas(r: RespostasEdital): { eixo: Eixo | 'Fora'; certeza: number } {
  const escolha = r.eixo.choice as Eixo | 'Fora';
  return { eixo: escolha, certeza: Math.round((r.eixo.probabilities?.[escolha] ?? r.eixo.confidence) * 100) };
}

/** Visão "TI/Pesquisa" das respostas, no formato do classificador OpenAI. Null se incerto (sem aceitarIncerto). */
export function resultadoTIDasRespostas(
  r: RespostasEdital,
  titulo: string,
  opcoes: { aceitarIncerto?: boolean } = {}
): AiClassificationResult | null {
  const pChamada = r.eh_chamada.noul;
  const pRelevante = r.relevante_ti.noul;
  const niveis = r.grau_relevancia.legend ? Object.keys(r.grau_relevancia.legend).length : 5;

  // A confiança é a certeza de "relevante para TI" (a dúvida sobre ser chamada é tratada à parte, na nota
  // do Jev e no filtro de "não é chamada"). Se o grau de relevância discorda, o julgamento fica incerto.
  const grauDiscorda = (pRelevante >= 0.5) !== (r.grau_relevancia.score >= Math.ceil((niveis - 1) / 2));
  const certezaRelevante = Math.round(certeza(pRelevante));
  const confianca = grauDiscorda ? Math.min(certezaRelevante, confiancaMinimaJev() - 1) : certezaRelevante;

  if (confianca < confiancaMinimaJev() && !opcoes.aceitarIncerto) {
    console.log(`   Jev incerto (${confianca}%) para "${titulo.substring(0, 40)}...", escalando.`);
    return null;
  }

  const score = Math.round((r.grau_relevancia.score / Math.max(niveis - 1, 1)) * 100);
  const tecnologia = normalizarTecnologia(r.tecnologia.choice);
  const tipo = normalizarTipo(r.tipo.choice);

  return {
    ok: true,
    válido: pChamada >= 0.5 && pRelevante >= 0.5,
    tecnologia,
    categoria: tecnologia,
    tipo,
    tipoFerramenta: tipo,
    score: Math.min(100, Math.max(0, score)),
    confiança: confianca,
    confianca,
    razão: `Jev: edital ${(pChamada * 100).toFixed(0)}%, relevante ${(pRelevante * 100).toFixed(0)}%, área "${r.tecnologia.choice}"`,
    usouCache: false,
    modelo: obterModeloJev(),
  };
}

/** Visão "Cultura" das respostas. */
export function julgamentoCulturaDasRespostas(r: RespostasEdital): {
  valido: boolean;
  confianca: number;
  razao: string;
} {
  const pChamada = r.eh_chamada.noul;
  const pRelevante = r.relevante_cultura.noul;
  return {
    valido: pChamada >= 0.5 && pRelevante >= 0.5,
    confianca: Math.round(Math.min(certeza(pChamada), certeza(pRelevante))),
    razao: `Jev: edital ${(pChamada * 100).toFixed(0)}%, cultura ${(pRelevante * 100).toFixed(0)}%`,
  };
}

/**
 * Triagem rápida (visão TI/Pesquisa) de um edital com o Jev.
 *
 * Retorna null quando o Jev não está disponível, falhou ou ficou incerto
 * (e quem chamou ainda tem outro classificador) — nesses casos o fluxo segue para a OpenAI.
 * Com `aceitarIncerto`, devolve o melhor julgamento mesmo abaixo da confiança mínima.
 */
export async function validarComJev(
  titulo: string,
  descricao: string,
  valor?: string,
  orgao?: string,
  termosBranco?: string[],
  tipoEdital?: string,
  opcoes: { aceitarIncerto?: boolean } = {}
): Promise<AiClassificationResult | null> {
  const respostas = await julgarEditalComJev({ titulo, descricao, valor, orgao, termosBranco, tipoEdital });
  if (!respostas) return null;
  return resultadoTIDasRespostas(respostas, titulo, opcoes);
}
