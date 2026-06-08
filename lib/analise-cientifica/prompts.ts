import { AnaliseConformidade, CriterioAvaliado, FeedbackSecao } from './schema';

// Tipos para contexto do edital científico
interface EditalCientificoContext {
  titulo: string;
  orgao: string;
  valor?: number;
  valorMax?: number;
  prazoMeses?: number;
  objetivo: string;
  criteriosAvaliacao: string[];
  itensFinanciaveis: string[];
  elegibilidade: string[];
  areasTematicas?: string[];
  nivel?: string;
}

// Tipos para proposta do usuário
interface UserProposal {
  id?: string;
  titulo: string;
  descricao: string;
  areaAtuacao?: string;
  propostaUsuario: string;
  nivel?: string;
  status?: string;
  dataCriacao?: string;
  versao?: number;
  resumoExecutivo?: string;
  justificativa?: string;
  objetivos?: any;
  metodologia?: string;
  resultadosEsperados?: string;
  referencias?: string;
  analiseExistente?: any;
}

// Resultado de busca
export interface SearchResult {
  title: string;
  url: string;
  content: string;
}

// Termos proibidos para linguagem acadêmica (evita sombreadores de IA)
const PROIBIDOS = [
  // Expressões clichê
  'mergulhe', 'jornada', 'desvendar', 'em resumo', 'em conclusao',
  'crucial', 'imperativo', 'notavel', 'tesouro', 'ademais',
  'primeiramente', 'eh importante ressaltar', 'no cenario atual',
  'uma tapeçaria de', 'alavancar', 'multifacetado', 'sinergia', 'catalisador',
  'de forma singular', 'em sua essencia', 'no cerne', 'fazendo uso',
  'no que tange', 'no tocante a', 'no que se refere', 'no que diz respeito',
  'no mbito', 'no universo de', 'no espectro de', 'no painel de',
  'vale ressaltar', 'cabe destacar', 'imprescindivel', 'incalculavel',
  'sem precedentes', 'nunca antes', 'revolucionario', 'transformador',
  // Padrões de sentença de IA
  'como resultado disso', 'por meio disso', 'a partir disso',
  'sendo assim', 'dessa forma', 'nesse sentido', 'nessa perspectiva',
  'levando em consideracao', 'tendo em vista', 'visto que', 'uma vez que',
  'por conseguinte', 'em face disso', 'diante disso',
  // Superlativos e exageros
  'extremamente', 'grandemente', 'enormemente', 'massivamente',
  'absolutamente', 'totalmente', 'completamente', 'inteiramente'
].join('|');

// Padrões de estrutura de sentença que indicam conteúdo gerado por IA
const PADROES_IA = [
  'é importante destacar que',
  'no contexto atual da sociedade',
  'face aos desafios contemporâneos',
  'no cenário globalizado',
  'no panorama atual',
  'a relevância deste estudo',
  'os resultados obtidos demonstram que',
  'os dados coletados evidenciam',
  'os resultados apontam para',
  'os achados sugerem que',
  'os resultados sugerem que',
  'os dados sugerem que',
  'os resultados evidenciam que',
  'os dados evidenciam que'
].join('|');

// Formatar fontes de busca
function formatarFontes(searchResults: SearchResult[]): string {
  if (!searchResults.length) return 'Nenhuma fonte encontrada.';
  return searchResults.map((r, i) =>
    `[${i + 1}] ${r.title} - ${r.url}\n   "${r.content.slice(0, 450)}..."`
  ).join('\n\n');
}

// Prompt para geração de proposta científica completa
export async function gerarPromptPropostaCientifica(
  edil: EditalCientificoContext,
  proposal: UserProposal,
  searchResults?: SearchResult[]
): Promise<string> {
  const valoresFinanciaveis = edil.itensFinanciaveis?.join('\n') || 'Nao especificado';
  const criterios = edil.criteriosAvaliacao?.join('\n') || 'Nao especificado';
  const elegibilidade = edil.elegibilidade?.join('\n') || 'Nao especificado';
  const areas = edil.areasTematicas?.join(', ') || 'Nao especificada';
  const fontesBusca = searchResults ? formatarFontes(searchResults) : 'Nenhuma busca realizada.';

  const resumeTxt = proposal.resumoExecutivo ? `\n- Resumo Executivo Existente: ${proposal.resumoExecutivo}` : '';
  const justifTxt = proposal.justificativa ? `\n- Justificativa Existente: ${proposal.justificativa}` : '';
  const metTxt = proposal.metodologia ? `\n- Metodologia Existente: ${proposal.metodologia}` : '';
  const resTxt = proposal.resultadosEsperados ? `\n- Resultados Esperados Existentes: ${proposal.resultadosEsperados}` : '';
  const refTxt = proposal.referencias ? `\n- Referências Existentes: ${proposal.referencias}` : '';
  
  const analiseTxt = proposal.analiseExistente ? `\n- Feedback/Recomendações da Análise de Conformidade Anterior: ${typeof proposal.analiseExistente === 'string' ? proposal.analiseExistente : JSON.stringify(proposal.analiseExistente.recomendacoes || proposal.analiseExistente.feedback || proposal.analiseExistente)}` : '';

  return `ATUE COMO um especialista sênior em elaboração de projetos científicos para editais de pesquisa e financiamento acadêmico (CNPq, CAPES, FAPESP, FINEP).

Você é um pesquisador-chefe experiente que já aprovou diversos projetos em agências de fomento. Escreva de forma profunda, detalhada e robusta, como um pesquisador sênior escreveria, sem simplificações ou respostas rasas.

A TAREFA:
Desenvolva uma proposta de projeto científico completa e bem estruturada seguindo os seguintes parâmetros:
* **Área de Atuação:** ${areas}
* **Tema Específico:** ${proposal.titulo}
* **Público-Alvo e Localidade:** ${proposal.areaAtuacao || 'Não especificado'}
* **Objeto/Ação Principal:** ${proposal.descricao}
* **Conteúdo Existente do Projeto (Aprimore estas seções e garanta consistência com elas):**${resumeTxt}${justifTxt}${metTxt}${resTxt}${refTxt}
* **Feedback/Críticas da Análise de Conformidade Anterior (ATENDA E CORRIJA obrigatoriamente todos estes pontos fracos apontados):**${analiseTxt}

DADOS DE BUSCA NA INTERNET (fontes reais obtidas via Tavily. Utilize estas informações para fundamentar teoricamente a justificativa, metodologia e resultados. Cite as referências utilizando o formato autor-data e as adicione de forma completa no campo "referencias"):
${fontesBusca}

CONTEXTO DO EDITAL CIENTÍFICO:
- Título: ${edil.titulo}
- Órgão: ${edil.orgao}
- Valor disponível: ${edil.valor ? `R$ ${edil.valor.toLocaleString('pt-BR')}` : 'Não especificado'}
${edil.valorMax ? `- Valor máximo financiável: R$ ${edil.valorMax.toLocaleString('pt-BR')}` : ''}
- Prazo máximo: ${edil.prazoMeses ? `${edil.prazoMeses} meses` : 'Não especificado'}
- Áreas temáticas: ${areas}
${edil.nivel ? `- Nível do projeto: ${edil.nivel}` : ''}

OBJETIVO DO EDITAL:
${edil.objetivo}

CRITÉRIOS DE AVALIAÇÃO (pontuação):
${criterios}

ITENS FINANCIADOS:
${valoresFinanciaveis}

ELEGIBILIDADE:
${elegibilidade}

REGRAS DE ESCRITA E QUALIDADE ACADÊMICA:
1. Escreva de forma extremamente profunda, com excelente fundamentação teórica.
2. Evite linguagem superficial ou clichês gerados por IA.
3. NUNCA use termos proibidos: ${PROIBIDOS.split('|').join(', ')}.
4. NUNCA use padrões de sentença típicos de IA: ${PADROES_IA.split('|').join(', ')}.
5. Realize citações diretas ou indiretas baseadas nos DADOS DE BUSCA reais disponibilizados acima.
6. A seção de REFERÊNCIAS bibliográficas deve listar as fontes reais utilizadas acima no padrão ABNT (Associação Brasileira de Normas Técnicas), incluindo autores, títulos, periódicos/portais e URLs quando aplicável. Não invente referências fictícias.
7. Não use placeholders ou "..." nos textos gerados. Todos os textos devem ser completos e detalhados.
8. Para seções textuais longas que possuam mais de 5 linhas (como resumoExecutivo, justificativa, metodologia, resultadosEsperados), analise o fluxo de ideias e organize-o de forma estruturada: infira e crie um parágrafo introdutório claro logo no início para contextualizar o leitor, e divida o restante do texto em múltiplos parágrafos bem demarcados e coerentes. Formate obrigatoriamente cada um desses parágrafos utilizando tags HTML <p> (ex: <p>Primeiro parágrafo...</p><p>Segundo parágrafo...</p>) para garantir uma apresentação organizada e profissional.

ESTRUTURA DA PROPOSTA:
Responda em formato JSON com as seguintes seções:
- resumoExecutivo: Síntese detalhada do projeto (250-500 palavras)
- justificativa: Defesa acadêmica aprofundada, contextualização do problema e relevância (com dados específicos e citações)
- objetivos: Objeto com "geral" (string) e "especificos" (array de objetos com cod, descricao, indicador, meta)
- metodologia: Procedimentos técnicos e científicos extremamente detalhados, etapas metodológicas bem definidas
- resultadosEsperados: Descrição em texto corrido e aprofundado dos impactos e resultados esperados (curto, médio e longo prazo)
- referencias: Lista de referências bibliográficas formatadas em ABNT com base nos resultados da busca
- orcamento: Detalhamento por categoria (administracao, divulgacao, equipe, materiais, outros) com valor e justificativa
- cronograma: Array de etapas com etapa, descricao, duracaoMeses, mesInicio, mesFim
- equipe: Array de membros com nome, funcao, qualificacao, dedicacao

IDIOMA: Responda integralmente em PORTUGUÊS BRASILEIRO.

IMPORTANTE: O texto final deve ter altíssimo rigor científico e parecer integralmente escrito por um pesquisador brasileiro sênior. Use informações das fontes de busca para fundamentar todas as alegações.`;
}

// Prompt para análise de conformidade
export async function gerarPromptAnaliseConformidade(
  projeto: any,
  edil: EditalCientificoContext
): Promise<string> {
  const criterios = edil.criteriosAvaliacao?.join('\n') || 'Nao especificado';

  return `ATUE COMO um avaliador especialista em projetos científicos para editais de pesquisa.

TAREFA:
Analise a conformidade do projeto científico abaixo em relação aos critérios do edital.

PROJETO A SER ANALISADO:
- Título: ${projeto.titulo}
- Área Temática: ${projeto.areaTematica}
- Resumo Executivo: ${projeto.resumoExecutivo || 'Nao informado'}
- Justificativa: ${projeto.justificativa || 'Nao informada'}
- Objetivos: ${projeto.objetivos || 'Nao informados'}
- Metodologia: ${projeto.metodologia || 'Nao informada'}
- Resultados Esperados: ${projeto.resultadosEsperados || 'Nao informados'}
- Orçamento: ${projeto.orcamento ? JSON.stringify(projeto.orcamento) : 'Nao informado'}
- Equipe: ${projeto.equipe ? JSON.stringify(projeto.equipe) : 'Nao informada'}

CRITÉRIOS DO EDITAL:
${criterios}

INSTRUÇÕES:
1. Avalie cada seção do projeto contra os critérios do edital
2. Atribua pontuação de 0 a 100 para cada critério
3. Identifique pontos fortes e fracos
4. Forneça sugestões específicas de melhoria
5. Calcule o score geral de conformidade

IDIOMA: Responda integralmente em PORTUGUÊS BRASILEIRO.

Responda em formato JSON com a seguinte estrutura:
{
  "criteriosAvaliados": [
    {
      "criterio": "nome do critério",
      "peso": número de 0 a 1,
      "pontuacao": número de 0 a 100,
      "atendido": true/false,
      "comentario": "avaliação do critério",
      "sugestao": "sugestão de melhoria (opcional)"
    }
  ],
  "scoreGeral": número de 0 a 100,
  "feedback": [
    {
      "secao": "nome da seção",
      "pontuacao": número de 0 a 100,
      "comentario": "feedback sobre a seção",
      "sugestoes": ["sugestão 1", "sugestão 2"]
    }
  ],
  "recomendacoes": ["recomendação 1", "recomendação 2"],
  "dataAnalise": "data ISO 8601"
}`;
}

// Prompt para polimento de seção
export function gerarPromptPolimento(
  secao: string,
  conteudo: string,
  tipoEdital: string
): string {
  return `ATUE COMO um especialista em escrita acadêmica para projetos científicos.

TAREFA:
Polimente o texto da seção "${secao}" para um projeto científico a ser submetido a um edital ${tipoEdital}.

CONTEÚDO ORIGINAL:
${conteudo}

INSTRUÇÕES:
1. Mantenha o sentido original do texto
2. Melhore a clareza e objetividade
3. Use linguagem acadêmica formal
4. Corrija erros gramaticais e de coesão
5. Evite termos proibidos: ${PROIBIDOS.split('|').join(', ')}
6. Mantenha o comprimento adequado da seção
7. Para seções textuais com mais de 5 linhas, analise o texto e organize-o estruturadamente: garanta a presença de um parágrafo introdutório coerente logo no início para ambientar o leitor, e organize o restante em parágrafos lógicos e fluídos demarcados com tags HTML <p> (ex: <p>Primeiro parágrafo...</p><p>Segundo parágrafo...</p>).

IDIOMA: Responda em PORTUGUÊS BRASILEIRO.

Responda apenas com o texto polido, sem explicações adicionais.`;
}

// Prompt para análise de adequação a edital
export function gerarPromptAdequacao(
  tituloProjeto: string,
  areaTematica: string,
  edil: EditalCientificoContext
): string {
  return `ATUE COMO um consultor especialista em editais de pesquisa científica.

TAREFA:
Analise a adequação de um projeto científico ao edital especificado.

PROJETO:
- Título: ${tituloProjeto}
- Área Temática: ${areaTematica}

EDITAL:
- Título: ${edil.titulo}
- Órgão: ${edil.orgao}
- Áreas Temáticas: ${edil.areasTematicas?.join(', ') || 'Nao especificadas'}
- Elegibilidade: ${edil.elegibilidade?.join('\n') || 'Nao especificada'}

INSTRUÇÕES:
1. Verifique se o projeto se enquadra na área temática do edital
2. Avalie se o nível do projeto atende à elegibilidade
3. Identifique pontos de alinhamento
4. Identifique possíveis desencontros
5. Forneça uma recomendação geral

IDIOMA: Responda em PORTUGUÊS BRASILEIRO.

Responda em formato JSON:
{
  "adequado": true/false,
  "scoreAdequacao": número de 0 a 100,
  "pontosAlinhamento": ["ponto 1", "ponto 2"],
  "pontosDesencontro": ["ponto 1", "ponto 2"],
  "recomendacao": "recomendação geral"
}`;
}

// Critérios de avaliação por área do conhecimento
export const CRITERIOS_POR_AREA = {
  'ciencias-exatas': [
    'Metodologia técnica e rigor experimental',
    'Inovação e originalidade',
    'Viabilidade técnica e recursos disponíveis',
    'Qualificação da equipe',
    'Impacto científico esperado'
  ],
  'ciencias-biologicas': [
    'Impacto ambiental e sustentabilidade',
    'Aspectos éticos e biossegurança',
    'Aplicabilidade dos resultados',
    'Metodologia apropriada',
    'Relevância para a área'
  ],
  'ciencias-humanas': [
    'Fundamentação teórica robusta',
    'Relevância social do projeto',
    'Metodologia adequada',
    'Contribuição para a área',
    'Inovação teórico-metodológica'
  ],
  'engenharias': [
    'Prototipagem e viabilidade técnica',
    'Escalabilidade da solução',
    'Resultados mensuráveis',
    'Inovação tecnológica',
    'Impacto econômico e social'
  ],
  'ciencias-saude': [
    'Ensaios clínicos ou estudos apropriados',
    'Aspectos éticos e regulatórios',
    'Impacto na saúde pública',
    'Metodologia científica',
    'Relevância clínica'
  ]
};

// Áreas temáticas para projetos científicos
export const AREAS_TEMATICAS = [
  'Ciências Exatas e da Terra',
  'Ciências Biológicas',
  'Ciências da Saúde',
  'Ciências Agrárias',
  'Ciências Humanas',
  'Ciências Sociais Aplicadas',
  'Engenharias',
  'Lingüística, Letras e Artes',
  'Multidisciplinar'
];

// Níveis de projeto científico
export const NIVEIS_PROJETO = [
  { valor: 'iniciacao', label: 'Iniciação Científica' },
  { valor: 'mestrado', label: 'Mestrado' },
  { valor: 'doutorado', label: 'Doutorado' },
  { valor: 'pos-doutorado', label: 'Pós-Doutorado' },
  { valor: 'pesquisador', label: 'Pesquisador' }
];
