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

/** Abaixo desta certeza (0-100) o Jev não decide sozinho e o caso sobe para a OpenAI. */
function confiancaMinima(): number {
  const valor = Number(process.env.JEV_CONFIANCA_MINIMA);
  return Number.isFinite(valor) && valor > 0 ? valor : 75;
}

const PERGUNTAS = {
  eh_chamada: {
    type: 'noul',
    instructions:
      'O texto descreve uma chamada pública, edital, seleção, bolsa, fomento ou evento científico com inscrição/submissão de propostas?',
    criteria: {
      true: 'Oferece oportunidade com processo de inscrição, submissão ou seleção (edital, chamada, fomento, congresso com submissão)',
      false: 'Notícia, resultado final, blog, curso, tutorial, página institucional ou conteúdo sem processo seletivo',
    },
  },
  relevante: {
    type: 'noul',
    instructions:
      'A oportunidade é relevante para TI, software, pesquisa científica e acadêmica, universidades, institutos federais, inovação tecnológica ou eventos científicos em ciência, tecnologia e inovação?',
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

/**
 * Triagem rápida de um edital com o Jev.
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
  if (!jevDisponivel()) return null;

  try {
    const { answers } = await consultarJev(
      {
        titulo,
        descricao: descricao.substring(0, 3000),
        valor: valor || null,
        orgao: orgao || null,
        palavras_chave: termosBranco ?? [],
        tipo_edital: tipoEdital ?? null,
      },
      PERGUNTAS
    );

    const pChamada = answers.eh_chamada.noul;
    const pRelevante = answers.relevante.noul;
    const confianca = Math.round(Math.min(certeza(pChamada), certeza(pRelevante)));
    const valido = pChamada >= 0.5 && pRelevante >= 0.5;

    if (confianca < confiancaMinima() && !opcoes.aceitarIncerto) {
      console.log(`   Jev incerto (${confianca}%) para "${titulo.substring(0, 40)}...", escalando.`);
      return null;
    }

    const niveis = answers.grau_relevancia.legend ? Object.keys(answers.grau_relevancia.legend).length : 5;
    const score = Math.round((answers.grau_relevancia.score / Math.max(niveis - 1, 1)) * 100);
    const tecnologia = normalizarTecnologia(answers.tecnologia.choice);
    const tipo = normalizarTipo(answers.tipo.choice);

    return {
      ok: true,
      válido: valido,
      tecnologia,
      categoria: tecnologia,
      tipo,
      tipoFerramenta: tipo,
      score: Math.min(100, Math.max(0, score)),
      confiança: confianca,
      confianca,
      razão: `Jev: edital ${(pChamada * 100).toFixed(0)}%, relevante ${(pRelevante * 100).toFixed(0)}%, área "${answers.tecnologia.choice}"`,
      usouCache: false,
      modelo: obterModeloJev(),
    };
  } catch (erro) {
    const msg = erro instanceof JevError ? erro.message : (erro as Error).message;
    console.warn(`   Jev indisponível (${msg}); seguindo para o classificador alternativo.`);
    return null;
  }
}
