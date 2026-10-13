import { validarWhitelistTI, validarBlacklist } from '../filtros-ti';

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
  /** O texto do documento foi confirmado como edital (palavras-chave + Jev, ver validacao-documento). */
  documentoConfirmado?: boolean;
  /** Eixo do edital; em 'Cultura' os termos de TI (whitelist/blacklist) não pontuam nem penalizam. */
  eixo?: 'Cultura' | 'Pesquisa';
}

export interface PontuacaoResultado {
  scoreFinal: number;
  nivel: 'baixo' | 'medio' | 'alto';
  recomendacao: 'ignorar' | 'analise_simplificada' | 'analise_completa';
  modoAnalise: 'ignorar' | 'simplificado' | 'completo';
  motivos: string[];
  whitelist: ReturnType<typeof validarWhitelistTI>;
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

  const ehCultura = params.eixo === 'Cultura';
  const whitelist = validarWhitelistTI(params.titulo, params.descricao);

  if (ehCultura) {
    score += 30;
    motivos.push('Eixo Cultura: termos de TI não se aplicam');
  } else if (whitelist.válido) {
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

  // A blacklist só informa: não tira pontos. Quem decide a relevância é o Jev.
  const passouBlacklist = ehCultura || validarBlacklist(params.titulo, params.descricao);
  if (!passouBlacklist) motivos.push('Atenção: termo da blacklist de TI no título (informativo, sem penalidade)');

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

  // Documento lido e confirmado como edital: é a evidência mais forte (substitui a antiga consulta à OpenAI)
  if (params.documentoConfirmado) {
    score += 30;
    motivos.push('Documento confirmado como edital pelas palavras-chave e pelo Jev');
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
  };
}
