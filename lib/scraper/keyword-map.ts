/**
 * MAPA DE PALAVRAS-CHAVE PARA VALIDAÇÃO DE EDITAIS
 * 
 * Usado para classificar automaticamente se um documento é um edital
 * baseado na densidade de termos específicos encontrados no conteúdo.
 * 
 * Densidade mínima: 5 palavras-chave por documento para ser considerado válido
 */

export const keywordMap = {
  // Termos obrigatórios (termos estruturais fundamentais de editais)
  mandatoryTerms: [
    "edital",
    "chamada pública",
    "chamada",
    "seleção",
    "processo seletivo",
    "inscrição",
    "submissão",
    "submissões",
    "proposta",
    "projeto",
    "cronograma",
    "prazo",
    "prazos",
    "resultado",
    "resultados",
    "requisitos",
    "elegibilidade",
    "critérios",
    "avaliação",
    "documentação",
    "anexo",
    "anexos"
  ],

  // Termos prováveis (contexto típico de editais)
  likelyTerms: [
    "objetivo",
    "objetivos",
    "objeto",
    "finalidade",
    "público-alvo",
    "proponente",
    "candidato",
    "candidatura",
    "projetos aprovados",
    "homologação",
    "classificação",
    "recurso",
    "recursos",
    "divulgação",
    "vigência",
    "execução",
    "contratação",
    "fomento",
    "financiamento",
    "apoio",
    "termo de outorga",
    "termo de compromisso",
    "convênio",
    "plano de trabalho"
  ],

  // Termos acadêmicos (contexto de pesquisa e educação)
  academicTerms: [
    "pesquisa",
    "pesquisa acadêmica",
    "iniciação científica",
    "inovação",
    "inovação tecnológica",
    "desenvolvimento tecnológico",
    "produção científica",
    "grupo de pesquisa",
    "linha de pesquisa",
    "área temática",
    "projeto de pesquisa",
    "bolsa de pesquisa",
    "orientador",
    "coordenador",
    "instituição de ensino",
    "instituição de pesquisa",
    "universidade",
    "ict",
    "currículo lattes",
    "mérito científico",
    "impacto científico"
  ],

  // Termos de financiamento (aspectos financeiros)
  fundingTerms: [
    "bolsa",
    "bolsas",
    "auxílio",
    "auxílio financeiro",
    "financiamento",
    "fomento",
    "recurso financeiro",
    "orçamento",
    "valor global",
    "valor total",
    "valor da bolsa",
    "despesas operacionais",
    "custeio",
    "capital",
    "contrapartida",
    "repasse"
  ],

  // Termos de elegibilidade (requisitos de participação)
  eligibilityTerms: [
    "elegibilidade",
    "critérios de elegibilidade",
    "condições de participação",
    "requisitos",
    "requisitos obrigatórios",
    "quem pode participar",
    "público-alvo",
    "perfil do candidato",
    "regularmente matriculado",
    "vínculo institucional",
    "docente orientador",
    "instituição proponente"
  ],

  // Termos de submissão (envio de propostas)
  submissionTerms: [
    "inscrição",
    "submissão",
    "envio da proposta",
    "apresentação da proposta",
    "formulário de inscrição",
    "sistema de submissão",
    "documentos comprobatórios",
    "arquivo em pdf",
    "plataforma",
    "cadastro",
    "preenchimento"
  ],

  // Termos de cronograma (datas e prazos)
  timelineTerms: [
    "cronograma",
    "calendário",
    "datas importantes",
    "período de inscrição",
    "prazo de inscrição",
    "data limite",
    "divulgação do resultado",
    "resultado preliminar",
    "resultado final",
    "prazo para recurso",
    "vigência"
  ],

  // Termos de avaliação (processo de julgamento)
  evaluationTerms: [
    "critérios de seleção",
    "critérios de avaliação",
    "julgamento",
    "avaliação de mérito",
    "mérito científico",
    "análise documental",
    "classificação",
    "nota final",
    "pontuação",
    "barema",
    "comissão avaliadora",
    "comitê julgador"
  ],

  // Tipos de oportunidade (categorias de editais)
  opportunityTerms: {
    editalPesquisa: [
      "edital de pesquisa",
      "chamada de pesquisa",
      "projeto de pesquisa",
      "apoio à pesquisa",
      "fomento à pesquisa"
    ],

    bolsaIC: [
      "iniciação científica",
      "pibic",
      "pibit",
      "bolsa de iniciação científica",
      "bolsista",
      "orientador"
    ],

    bolsaPos: [
      "mestrado",
      "doutorado",
      "bolsa de mestrado",
      "bolsa de doutorado",
      "pós-graduação",
      "discente"
    ],

    eventoCientifico: [
      "evento científico",
      "congresso",
      "seminário",
      "simpósio",
      "workshop",
      "submissão de trabalhos",
      "apresentação de artigos"
    ],

    mobilidade: [
      "mobilidade acadêmica",
      "intercâmbio",
      "missão de pesquisa",
      "cooperação internacional",
      "doutorado sanduíche"
    ],

    residenciaTecnologica: [
      "residência tecnológica",
      "residência em tic",
      "formação aplicada",
      "capacitação tecnológica"
    ]
  },

  // Termos negativos (indicam que NÃO é edital de nossa área)
  negativeTerms: [
    "pregão",
    "licitação",
    "menor preço",
    "termo de referência",
    "fornecedor",
    "registro de preços",
    "dispensa de licitação",
    "compra pública",
    "contratação de empresa"
  ]
} as const;

/**
 * Tipo para acessar os grupos de keywords
 */
export type KeywordGroup = keyof typeof keywordMap;

/**
 * Tipo para oportunidades específicas
 */
export type OpportunityType = keyof typeof keywordMap.opportunityTerms;

/**
 * Interface de resultado da validação de keywords
 */
export interface ResultadoValidacaoKeywords {
  // Decisão
  isEdital: boolean;                    // Passou no threshold de densidade?
  scoreTotal: number;                   // 0-100 (baseado em densidade)
  confianca: number;                    // 0-100% (confiança da classificação)
  
  // Estatísticas detalhadas
  contagem: {
    mandatoryTerms: number;
    likelyTerms: number;
    academicTerms: number;
    fundingTerms: number;
    eligibilityTerms: number;
    submissionTerms: number;
    timelineTerms: number;
    evaluationTerms: number;
    negativeTerms: number;
    opportunityTerms: Record<OpportunityType, number>;
  };

  // Análise
  densidadeKeywords: number;            // Palavras-chave por 1000 chars
  palavrasEncontradas: string[];        // Lista de palavras encontradas
  oportunidadesDetectadas: OpportunityType[]; // Tipos de oportunidade encontradas
  
  // Detalhes de rejeição
  motivo?: string;                      // Por que foi rejeitado?
  avisos: string[];                     // Alertas (ex: muitos termos negativos)
}
