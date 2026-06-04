import { validarWhitelistTI, validarBlacklist } from '../scraper/filtros-ti';
import { classificarSeEhEdital, ResultadoClassificacao } from './classifier';
import {
  computeContentHash,
  getCachedClassification,
  setCachedClassification,
  ClassificationCacheEntry
} from './classification-cache';

export type FonteConteudo = 'pdf_s3' | 'pdf_link' | 'html_link' | 'descricao_api' | 'sem_pdf' | undefined;

export interface PontuacaoParametros {
  titulo: string;
  descricao: string;
  url: string;
  orgao?: string;
  portalOrigem?: string;
  fonteConteudo?: FonteConteudo;
  pdfEncontrado: boolean;
  pdfReal: boolean;
  textoExtraido?: string;
  pdfUrlEncontrada?: string;
}

export interface PontuacaoResultado {
  scoreFinal: number;
  nivel: 'baixo' | 'medio' | 'alto';
  recomendacao: 'ignorar' | 'analise_simplificada' | 'analise_completa';
  modoAnalise: 'ignorar' | 'simplificado' | 'completo';
  motivos: string[];
  whitelist: ReturnType<typeof validarWhitelistTI>;
  classificacao?: ResultadoClassificacao | null;
  cacheUsado?: boolean;
  hashConteudo?: string;
}

const PORTAIS_VALIDOS = new Set([
  'FINEP',
  'CNPq',
  'CAPES',
  'Prosas',
  'Ministério da Ciência',
  'Ministério da Ciência, Tecnologia e Inovações'
]);

export async function calcularPontuacaoEdital(params: PontuacaoParametros): Promise<PontuacaoResultado> {
  const motivos: string[] = [];
  let score = 0;

  const whitelist = validarWhitelistTI(params.titulo, params.descricao);

  if (whitelist.válido) {
    const base = whitelist.confidence === 'alta'
      ? 30
      : whitelist.confidence === 'média'
        ? 22
        : 12;

    score += base;
    motivos.push(`Whitelist TI: confiança ${whitelist.confidence}`);

    const bonus = Math.min(whitelist.termosBranco.length * 2, 10);
    if (bonus > 0) {
      score += bonus;
      motivos.push(`Palavras-chave relevantes (${whitelist.termosBranco.slice(0, 3).join(', ')})`);
    }
  } else {
    motivos.push('Whitelist TI: nenhum termo relevante encontrado');
  }

  const passouBlacklist = validarBlacklist(params.titulo, params.descricao);
  if (!passouBlacklist) {
    score -= 35;
    motivos.push('Termo bloqueado identificado (blacklist)');
  }

  if (params.pdfEncontrado) {
    score += params.pdfReal ? 20 : 12;
    motivos.push(params.pdfReal ? 'PDF oficial encontrado' : 'Conteúdo alternativo localizado');
  } else {
    motivos.push('Nenhum PDF encontrado');
  }

  if (params.textoExtraido && params.textoExtraido.length > 1500) {
    score += 5;
    motivos.push('Conteúdo extenso disponível para análise');
  }

  if (params.orgao && PORTAIS_VALIDOS.has(params.orgao)) {
    score += 5;
    motivos.push(`Portal confiável (${params.orgao})`);
  }

  let classificacao: ResultadoClassificacao | null = null;
  let cacheUsado = false;
  let hashConteudo: string | undefined;

  if (params.pdfEncontrado && score < 70) {
    hashConteudo = computeContentHash(params.titulo, params.descricao, params.pdfUrlEncontrada || params.url);
    const cacheEntry = getCachedClassification<ResultadoClassificacao>(hashConteudo);

    if (cacheEntry) {
      classificacao = cacheEntry.data || null;
      cacheUsado = true;
      motivos.push('Classificação obtida via cache (30 dias)');
    } else {
      try {
        classificacao = await classificarSeEhEdital(params.titulo, params.descricao, params.url, params.orgao);
        if (classificacao) {
          setCachedClassification(hashConteudo, classificacao);
        }
      } catch (error) {
        motivos.push(`Falha ao classificar com IA: ${(error as Error).message}`);
      }
    }

    if (classificacao) {
      if (classificacao.isEdital) {
        const bonus = Math.min(40, Math.round((classificacao.confianca / 100) * 40));
        score += bonus;
        motivos.push(`OpenAI confirmou edital (${classificacao.confianca}%)`);
      } else {
        score -= 30;
        motivos.push('OpenAI indicou que não é edital');
      }
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const nivel: PontuacaoResultado['nivel'] = score >= 80 ? 'alto' : score >= 60 ? 'medio' : 'baixo';

  let recomendacao: PontuacaoResultado['recomendacao'] = 'ignorar';
  let modoAnalise: PontuacaoResultado['modoAnalise'] = 'ignorar';

  if (!params.pdfEncontrado) {
    recomendacao = 'ignorar';
    modoAnalise = 'ignorar';
  } else if (score >= 80 && params.pdfReal) {
    recomendacao = 'analise_completa';
    modoAnalise = 'completo';
  } else if (score >= 60) {
    recomendacao = 'analise_simplificada';
    modoAnalise = 'simplificado';
  }

  return {
    scoreFinal: score,
    nivel,
    recomendacao,
    modoAnalise,
    motivos,
    whitelist,
    classificacao,
    cacheUsado,
    hashConteudo
  };
}
