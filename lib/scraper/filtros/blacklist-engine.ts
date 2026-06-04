import { loadBlacklist } from './loaders';

export interface BlacklistTermMatch {
  termo: string;
  ocorrencias: number;
  contexto?: string;
  peso: number;
}

export interface BlacklistResult {
  scoreNegativo: number;
  termosEncontrados: BlacklistTermMatch[];
  severidade: 'baixa' | 'media' | 'alta';
  recomendacao: 'penalizar' | 'revisar' | 'bloquear';
  motivos: string[];
}

/**
 * Função utilitária para contar ocorrências de uma substring em um texto
 */
function contarOcorrencias(texto: string, termo: string): number {
  if (!texto || !termo) return 0;
  
  // Escapa caracteres especiais para segurança no Regex
  const termoEscapado = termo.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  // Procura o termo respeitando limites de palavras (word boundaries) quando aplicável
  // Usamos limite flexível para lidar com acentuação em português
  const regex = new RegExp(termoEscapado, 'gi');
  const matches = texto.match(regex);
  return matches ? matches.length : 0;
}

/**
 * Processa o título e a descrição de um edital contra as regras da blacklist.
 * Avalia os termos indesejados, desconta exceções contextuais e calcula o score negativo.
 */
export function analisarBlacklist(titulo: string, descricao: string): BlacklistResult {
  const textoCompleto = `${titulo} ${descricao}`.toLowerCase();
  const { blacklist, excecoes } = loadBlacklist();
  
  const termosEncontrados: BlacklistTermMatch[] = [];
  let scoreNegativo = 0;
  const motivos: string[] = [];

  for (const termo of blacklist) {
    const termoMin = termo.toLowerCase();
    const rawCount = contarOcorrencias(textoCompleto, termoMin);
    
    if (rawCount > 0) {
      // 1. Verificar exceções associadas a este termo
      const excecoesDoTermo = excecoes[termoMin] || [];
      let totalDesconto = 0;
      let totalmenteExceptuado = false;
      let contextoExcecao = '';

      for (const excecao of excecoesDoTermo) {
        const excecaoMin = excecao.toLowerCase();
        const countExcecao = contarOcorrencias(textoCompleto, excecaoMin);
        
        if (countExcecao > 0) {
          if (excecaoMin.includes(termoMin)) {
            // Caso 1: A exceção contém o termo como substring (ex: "saúde digital" contém "saúde")
            totalDesconto += countExcecao;
            contextoExcecao += `Exceção '${excecao}' encontrada ${countExcecao}x. `;
          } else {
            // Caso 2: A exceção não contém o termo (ex: "e-health" para "saúde").
            // Funciona como um sinal de contexto seguro global para este termo.
            totalmenteExceptuado = true;
            contextoExcecao += `Contexto seguro '${excecao}' detectado. `;
          }
        }
      }

      // 2. Calcular ocorrências efetivas (descontando as exceções)
      let effectiveCount = totalmenteExceptuado ? 0 : Math.max(0, rawCount - totalDesconto);

      if (effectiveCount > 0) {
        // Cada termo na blacklist tem um peso base de 15 pontos
        // Ocorrências adicionais somam 5 pontos cada, limitando a 35 pontos por termo
        const pesoBase = 15;
        const pesoAdicional = (effectiveCount - 1) * 5;
        const pesoTotalTermo = Math.min(35, pesoBase + pesoAdicional);

        scoreNegativo += pesoTotalTermo;
        
        let contexto = '';
        if (totalDesconto > 0) {
          contexto = `${contextoExcecao}Reduzido de ${rawCount} para ${effectiveCount} ocorrências.`;
        }

        termosEncontrados.push({
          termo,
          ocorrencias: effectiveCount,
          contexto: contexto || undefined,
          peso: pesoTotalTermo
        });

        motivos.push(`Termo bloqueado '${termo}' encontrado (${effectiveCount}x, peso -${pesoTotalTermo})`);
      } else if (rawCount > 0) {
        // Ocorrências encontradas mas totalmente neutralizadas por exceções
        console.log(`   [Blacklist] Termo '${termo}' ignorado devido ao contexto: ${contextoExcecao}`);
      }
    }
  }

  // 3. Determinar severidade e recomendação com base no score acumulado
  let severidade: 'baixa' | 'media' | 'alta' = 'baixa';
  let recomendacao: 'penalizar' | 'revisar' | 'bloquear' = 'penalizar';

  if (scoreNegativo > 45) {
    severidade = 'alta';
    recomendacao = 'bloquear';
  } else if (scoreNegativo > 20) {
    severidade = 'media';
    recomendacao = 'revisar';
  } else if (scoreNegativo > 0) {
    severidade = 'baixa';
    recomendacao = 'penalizar';
  }

  return {
    scoreNegativo,
    termosEncontrados,
    severidade,
    recomendacao,
    motivos
  };
}
