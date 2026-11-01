/**
 * EXTRATOR DE DADOS ESTRUTURADOS DE EDITAIS
 * 
 * Extrai informações principais do edital usando IA (modo simplificado)
 * e salva no banco de dados em formato estruturado.
 * 
 * Dados extraídos:
 * - Resumo e objetivo
 * - Datas principais
 * - Valores e financiamento
 * - Requisitos e elegibilidade
 * - Cronograma
 */


/**
 * Interface para dados extraídos do edital
 */
export interface DadosEditaisExtraidos {
  // Identificação
  titulo: string;
  resumo: string;
  objetivo: string;

  // Datas importantes
  datas: {
    publicacao?: string;
    abertura?: string;
    encerramento?: string;
    resultado?: string;
  };

  // Aspectos financeiros
  financeiro: {
    valorTotal?: string;
    valorMin?: number;
    valorMax?: number;
    moeda?: string;
    tipo?: string; // bolsa, auxílio, repasse, etc
  };

  // Elegibilidade
  elegibilidade: {
    tiposProponentes: string[];
    requisitosMinimos: string[];
    restricoes?: string[];
    abrangencia?: string;
  };

  // Cronograma resumido
  cronograma: string;

  // Metadados da extração
  confiancaExtracao: number; // 0-100%
  metodosUsados: string[]; // "keywords", "ia", "heuristica"
  errosExtracao?: string[];
}

/**
 * Formata dados extraídos para exibição
 */
export function formatarDadosExtraidos(dados: DadosEditaisExtraidos): string {
  return `
📄 DADOS EXTRAÍDOS DO EDITAL

📋 Identificação:
   Título: ${dados.titulo}
   Objetivo: ${dados.objetivo || 'Não identificado'}
   Resumo: ${dados.resumo || 'Não identificado'}

📅 Datas Importantes:
   Encerramento: ${dados.datas.encerramento || 'Não informado'}
   Resultado: ${dados.datas.resultado || 'Não informado'}

💰 Financeiro:
   Valor Total: ${dados.financeiro.valorTotal || 'Não informado'}
   Tipo: ${dados.financeiro.tipo || 'Não especificado'}

👥 Elegibilidade:
   Proponentes: ${dados.elegibilidade.tiposProponentes.join(', ') || 'Não especificado'}
   Requisitos: ${dados.elegibilidade.requisitosMinimos.join(', ') || 'Não especificado'}
   Abrangência: ${dados.elegibilidade.abrangencia}

📆 Cronograma:
   ${dados.cronograma || 'Não informado'}

🎯 Qualidade da Extração:
   Confiança: ${dados.confiancaExtracao}%
   Métodos: ${dados.metodosUsados.join(', ')}
   ${dados.errosExtracao && dados.errosExtracao.length > 0 ? `Erros: ${dados.errosExtracao.join(', ')}` : ''}
  `;
}
