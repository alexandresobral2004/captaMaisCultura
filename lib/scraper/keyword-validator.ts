/**
 * VALIDADOR DE EDITAIS COM BASE EM PALAVRAS-CHAVE
 * 
 * Analisa o conteúdo de um PDF procurando por palavras-chave específicas.
 * Se encontrar densidade mínima de 5 palavras-chave, classifica como edital válido.
 * 
 * Estratégia:
 * - Normaliza texto (minúsculas, remove acentos)
 * - Conta ocorrências por categoria de keyword
 * - Calcula densidade (palavras por 1000 caracteres)
 * - Retorna score e decisão
 */

import { keywordMap, ResultadoValidacaoKeywords, OpportunityType } from './keyword-map';

/**
 * Normaliza texto para comparação (minúsculas, remove acentos)
 */
function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacríticos
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Conta ocorrências de um termo no texto (case-insensitive, word boundaries)
 */
function contarOcorrencias(texto: string, termo: string): number {
  // Normalizar termo
  const termoNormalizado = termo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  
  // Criar regex com word boundaries
  const regex = new RegExp(`\\b${termoNormalizado}\\b`, 'gi');
  const matches = texto.match(regex);
  
  return matches ? matches.length : 0;
}

/**
 * Valida conteúdo de edital com base em densidade de palavras-chave
 * 
 * @param textoCompleto - Texto extraído do PDF
 * @param densidadeMinima - Número mínimo de palavras-chave (default: 5)
 * @returns Resultado detalhado da validação
 */
export async function validarConteudoComKeywords(
  textoCompleto: string,
  densidadeMinima: number = 5
): Promise<ResultadoValidacaoKeywords> {
  const textoNormalizado = normalizarTexto(textoCompleto);
  const tamanhoBruto = textoCompleto.length;
  
  // Inicializar contadores
  const contagem = {
    mandatoryTerms: 0,
    likelyTerms: 0,
    academicTerms: 0,
    fundingTerms: 0,
    eligibilityTerms: 0,
    submissionTerms: 0,
    timelineTerms: 0,
    evaluationTerms: 0,
    negativeTerms: 0,
    opportunityTerms: {
      editalPesquisa: 0,
      bolsaIC: 0,
      bolsaPos: 0,
      eventoCientifico: 0,
      mobilidade: 0,
      residenciaTecnologica: 0
    } as Record<OpportunityType, number>
  };

  const palavrasEncontradas: string[] = [];
  const oportunidadesDetectadas: OpportunityType[] = [];

  // Contar termos obrigatórios
  for (const termo of keywordMap.mandatoryTerms) {
    const count = contarOcorrencias(textoNormalizado, termo);
    if (count > 0) {
      contagem.mandatoryTerms += count;
      palavrasEncontradas.push(termo);
    }
  }

  // Contar termos prováveis
  for (const termo of keywordMap.likelyTerms) {
    const count = contarOcorrencias(textoNormalizado, termo);
    if (count > 0) {
      contagem.likelyTerms += count;
      palavrasEncontradas.push(termo);
    }
  }

  // Contar termos acadêmicos
  for (const termo of keywordMap.academicTerms) {
    const count = contarOcorrencias(textoNormalizado, termo);
    if (count > 0) {
      contagem.academicTerms += count;
      palavrasEncontradas.push(termo);
    }
  }

  // Contar termos de financiamento
  for (const termo of keywordMap.fundingTerms) {
    const count = contarOcorrencias(textoNormalizado, termo);
    if (count > 0) {
      contagem.fundingTerms += count;
      palavrasEncontradas.push(termo);
    }
  }

  // Contar termos de elegibilidade
  for (const termo of keywordMap.eligibilityTerms) {
    const count = contarOcorrencias(textoNormalizado, termo);
    if (count > 0) {
      contagem.eligibilityTerms += count;
      palavrasEncontradas.push(termo);
    }
  }

  // Contar termos de submissão
  for (const termo of keywordMap.submissionTerms) {
    const count = contarOcorrencias(textoNormalizado, termo);
    if (count > 0) {
      contagem.submissionTerms += count;
      palavrasEncontradas.push(termo);
    }
  }

  // Contar termos de cronograma
  for (const termo of keywordMap.timelineTerms) {
    const count = contarOcorrencias(textoNormalizado, termo);
    if (count > 0) {
      contagem.timelineTerms += count;
      palavrasEncontradas.push(termo);
    }
  }

  // Contar termos de avaliação
  for (const termo of keywordMap.evaluationTerms) {
    const count = contarOcorrencias(textoNormalizado, termo);
    if (count > 0) {
      contagem.evaluationTerms += count;
      palavrasEncontradas.push(termo);
    }
  }

  // Contar termos negativos (licitação, pregão, etc)
  for (const termo of keywordMap.negativeTerms) {
    const count = contarOcorrencias(textoNormalizado, termo);
    if (count > 0) {
      contagem.negativeTerms += count;
    }
  }

  // Contar tipos de oportunidade
  for (const [tipo, termos] of Object.entries(keywordMap.opportunityTerms)) {
    let totalTipo = 0;
    for (const termo of termos) {
      totalTipo += contarOcorrencias(textoNormalizado, termo);
    }
    if (totalTipo > 0) {
      contagem.opportunityTerms[tipo as OpportunityType] = totalTipo;
      if (!oportunidadesDetectadas.includes(tipo as OpportunityType)) {
        oportunidadesDetectadas.push(tipo as OpportunityType);
      }
    }
  }

  // Calcular estatísticas
  const totalPalavrasChave =
    contagem.mandatoryTerms +
    contagem.likelyTerms +
    contagem.academicTerms +
    contagem.fundingTerms +
    contagem.eligibilityTerms +
    contagem.submissionTerms +
    contagem.timelineTerms +
    contagem.evaluationTerms;

  const densidadeKeywords = tamanhoBruto > 0
    ? (totalPalavrasChave / tamanhoBruto) * 1000
    : 0;

  // Remover duplicatas na lista de palavras encontradas
  const palavrasUnicas = Array.from(new Set(palavrasEncontradas));

  // Determinar validação
  const avisos: string[] = [];
  let isEdital = totalPalavrasChave >= densidadeMinima;

  // Alertas e ajustes de decisão
  if (contagem.negativeTerms > totalPalavrasChave * 0.1) {
    avisos.push('⚠️ Muitos termos de licitação/compra encontrados - pode não ser edital');
    if (contagem.negativeTerms > contagem.mandatoryTerms) {
      isEdital = false; // Rejeitar se negativos superarem obrigatórios
    }
  }

  if (contagem.mandatoryTerms === 0) {
    avisos.push('⚠️ Nenhum termo obrigatório encontrado - baixa confiança');
    if (totalPalavrasChave < densidadeMinima * 2) {
      isEdital = false; // Muito rigoroso sem termos obrigatórios
    }
  }

  // Calcular score total (0-100)
  // Fórmula: densidade de keywords normalizada
  // Score máximo em 20+ palavras diferentes, cresce logaritmicamente
  const scoreTotal = Math.min(
    100,
    Math.round((totalPalavrasChave / densidadeMinima) * 25)
  );

  // Confiança baseada em:
  // - Score total
  // - Presença de termos obrigatórios
  // - Ausência de termos negativos
  let confianca = scoreTotal;
  if (contagem.mandatoryTerms > 0) confianca = Math.min(100, confianca + 10);
  if (contagem.negativeTerms > 0) confianca = Math.max(0, confianca - 15);
  if (oportunidadesDetectadas.length > 1) confianca = Math.min(100, confianca + 5);

  const motivo = isEdital
    ? `Validado: ${totalPalavrasChave} palavras-chave encontradas (densidade: ${densidadeKeywords.toFixed(2)}/1000)`
    : `Rejeitado: Apenas ${totalPalavrasChave} palavras-chave encontradas (mínimo: ${densidadeMinima})`;

  return {
    isEdital,
    scoreTotal,
    confianca: Math.round(confianca),
    contagem,
    densidadeKeywords: Math.round(densidadeKeywords * 100) / 100,
    palavrasEncontradas: palavrasUnicas,
    oportunidadesDetectadas,
    motivo,
    avisos
  };
}

/**
 * Versão simplificada para logging (não usada na pipeline, só para debug)
 */
export function resumoValidacaoKeywords(resultado: ResultadoValidacaoKeywords): string {
  return `
  ✅ Resultado: ${resultado.isEdital ? 'EDITAL VÁLIDO' : 'REJEITADO'}
  📊 Score: ${resultado.scoreTotal}% | Confiança: ${resultado.confianca}%
  🔍 Palavras encontradas: ${resultado.palavrasEncontradas.length} únicas
     - Obrigatórias: ${resultado.contagem.mandatoryTerms}
     - Prováveis: ${resultado.contagem.likelyTerms}
     - Acadêmicas: ${resultado.contagem.academicTerms}
     - Financiamento: ${resultado.contagem.fundingTerms}
     - Elegibilidade: ${resultado.contagem.eligibilityTerms}
     - Submissão: ${resultado.contagem.submissionTerms}
     - Cronograma: ${resultado.contagem.timelineTerms}
     - Avaliação: ${resultado.contagem.evaluationTerms}
     - Negativas: ${resultado.contagem.negativeTerms}
  🎯 Oportunidades detectadas: ${resultado.oportunidadesDetectadas.join(', ') || 'Nenhuma'}
  💬 Motivo: ${resultado.motivo}
  ${resultado.avisos.length > 0 ? `⚠️ Avisos:\n${resultado.avisos.map(a => '   ' + a).join('\n')}` : ''}
  `;
}
