import { PropostaCompleta } from './schema-projeto';

interface EditalContext {
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
}

interface UserProposal {
  titulo: string;
  descricao: string;
  areaAtuacao?: string;
  propostaUsuario: string;
}

export interface SearchResult {
  title: string;
  url: string;
  content: string;
}

const PROIBIDOS = [
  'mergulhe', 'jornada', 'desvendar', 'em resumo', 'em conclusao',
  'crucial', 'imperativo', 'notavel', 'tesouro', 'ademais',
  'primeiramente', 'eh importante ressaltar', 'no cenario atual',
  'uma tapeçaria de', 'alavancar', 'multifacetado', 'sinergia', 'catalisador'
].join('|');

function formatarFontes(searchResults: SearchResult[]): string {
  if (!searchResults.length) return 'Nenhuma fonte encontrada.';
  return searchResults.map((r, i) =>
    `[${i + 1}] ${r.title} - ${r.url}\n   "${r.content.slice(0, 400)}..."`
  ).join('\n\n');
}

export function gerarPromptCompleto(
  edil: EditalContext,
  proposal: UserProposal,
  searchResults?: SearchResult[]
): string {
  const valoresFinanciaveis = edil.itensFinanciaveis?.join('\n') || 'Nao especificado';
  const criterios = edil.criteriosAvaliacao?.join('\n') || 'Nao especificado';
  const elegibilidade = edil.elegibilidade?.join('\n') || 'Nao especificado';
  const areas = edil.areasTematicas?.join(', ') || 'Nao especificada';
  const fontesBusca = searchResults ? formatarFontes(searchResults) : 'Nenhuma busca realizada.';

  return `ATUE COMO um especialista senior em formulacao de projetos tecnicos, captacao de recursos e escrita para editais publicos e privados.

A TAREFA:
Desenvolva a estrutura narrativa de um projeto executivo focado nos seguintes parametros:
* **Area de Atuacao:** ${areas}
* **Tema Especifico:** ${proposal.titulo}
* **Publico-Alvo e Localidade:** ${proposal.areaAtuacao || 'Nao especificado'}
* **Objeto/Acao Principal:** ${proposal.descricao}

DADOS DE BUSCA (fontes reais para fundamentacao):
${fontesBusca}

CONTEXTO DO EDITAL:
- Titulo: ${edil.titulo}
- Orgao: ${edil.orgao}
- Valor disponivel: ${edil.valor ? `R$ ${edil.valor.toLocaleString('pt-BR')}` : 'Nao especificado'}
${edil.valorMax ? `- Valor maximo financiavel: R$ ${edil.valorMax.toLocaleString('pt-BR')}` : ''}
- Prazo maximo: ${edil.prazoMeses ? `${edil.prazoMeses} meses` : 'Nao especificado'}
- Areas tematicas: ${areas}

OBJETIVO DO EDITAL:
${edil.objetivo}

CRITERIOS DE AVALIACAO (pontuacao):
${criterios}

ITENS FINANCIADOS:
${valoresFinanciaveis}

ELEGIBILIDADE:
${elegibilidade}

PROPOSTA DO USUARIO:
- Titulo sugerido: ${proposal.titulo}
- Descricao: ${proposal.descricao}
- Area de atuacao: ${proposal.areaAtuacao || 'Nao especificada'}
- Proposta detalhada:
${proposal.propostaUsuario}

---

REQUISITOS MINIMOS DE CONTEUDO (OBRIGATORIOS):

1. **RESUMO EXECUTIVO** - EXATAMENTE 5 PARAGRAFOS DISTINTOS:
   - Paragrafo 1: Contextualizacao do problema e marco teorico (3-4 frases)
   - Paragrafo 2: Descricao da solucao proposta e sua innovacao (3-4 frases)
   - Paragrafo 3: Principais objetivos e alcances esperados (3-4 frases)
   - Paragrafo 4: Metodologia geral e abordagem operacional (3-4 frases)
   - Paragrafo 5: Resultado esperado e impacto na comunidade/alvo (3-4 frases)
   CADA PARAGRAFO DEVE TER NO MINIMO 3 FRASES COMPLETAS.

2. **JUSTIFICATIVA** - EXATAMENTE 4-5 PARAGRAFOS:
   - Paragrafo 1: Analise de dados estatisticos das fontes [1], [2] etc (obrigatorio citar fontes)
   - Paragrafo 2: Descricao da problematica e gaps existentes
   - Paragrafo 3: Relevancia social e impacto territorial
   - Paragrafo 4: Alineamento com politicas publicas e editais
   - Paragrafo 5 (opcional): Experiencias exitosas similares como referencia

3. **OBJETIVOS** - ESTRUTURA JSON OBRIGATORIA:
   {
     "geral": "Texto do objetivo geral (1-2 frases)",
     "especificos": [
       {"cod": "OE1", "descricao": "Descricao completa do objetivo especifico 1", "indicador": "Indicador mensuravel", "meta": "Meta quantitativa"},
       {"cod": "OE2", "descricao": "Descricao completa do objetivo especifico 2", "indicador": "Indicador mensuravel", "meta": "Meta quantitativa"},
       {"cod": "OE3", "descricao": "Descricao completa do objetivo especifico 3", "indicador": "Indicador mensuravel", "meta": "Meta quantitativa"},
       {"cod": "OE4", "descricao": "Descricao completa do objetivo especifico 4", "indicador": "Indicador mensuravel", "meta": "Meta quantitativa"},
       {"cod": "OE5", "descricao": "Descricao completa do objetivo especifico 5", "indicador": "Indicador mensuravel", "meta": "Meta quantitativa"}
     ]
   }
   MINIMO 4 OBJETIVOS ESPECIFICOS. CADA OE COM NO MINIMO 2 FRASES.

4. **METODOLOGIA** - EXATAMENTE 6 PARAGRAFOS:
   - Paragrafo 1: Abordagem teorica e paradigmas metodologicos
   - Paragrafo 2: Procedimentos operacionais e cronograma de atividades
   - Paragrafo 3: Instrumentos de coleta de dados e ferramentas
   - Paragrafo 4: Metodos de analise e tratamento de dados
   - Paragrafo 5: Gestao do projeto e responsabilidades da equipe
   - Paragrafo 6: Mecanismos de monitoramento e evaluacao

5. **RESULTADOS ESPERADOS** - ESTRUTURA JSON COM 3 HORIZONTES TEMPORAIS:
   {
     "curtoPrazo": {
       "descricao": "Resultados/produtos entregues ao final do projeto (0-12 meses)",
       "indicadores": [
         {"indicador": "Indicador mensuravel 1", "meta": "Meta quantitativa 1"},
         {"indicador": "Indicador mensuravel 2", "meta": "Meta quantitativa 2"}
       ]
     },
     "medioPrazo": {
       "descricao": "Resultados esperados apos consolidacao (1-3 anos)",
       "indicadores": [
         {"indicador": "Indicador mensuravel 1", "meta": "Meta quantitativa 1"},
         {"indicador": "Indicador mensuravel 2", "meta": "Meta quantitativa 2"}
       ]
     },
     "longoPrazo": {
       "descricao": "Impactos de longo prazo na comunidade/sociedade (3+ anos)",
       "indicadores": [
         {"indicador": "Indicador mensuravel 1", "meta": "Meta quantitativa 1"},
         {"indicador": "Indicador mensuravel 2", "meta": "Meta quantitativa 2"}
       ]
     }
   }
   CADA HORIZONTE DEVE TER DESCRICAO DE 2-3 FRASES E MINIMO 2 INDICADORES COM METAS.

   6. **ORCAMENTO DETALHADO** - ESTRUTURA JSON COM CATEGORIAS:
   {
     "administracao": {"valor": numero, "justificativa": "Texto justificando custo administrativo (max 15% do total)"},
     "divulgacao": {"valor": numero, "justificativa": "Texto justificando custos de divulgacao/promocao"},
     "equipe": {"valor": numero, "justificativa": "Texto justificando remuneracao da equipe"},
     "materiais": {"valor": numero, "justificativa": "Texto justificando custos com materiais e insumos"},
     "outros": {"valor": numero, "justificativa": "Texto justificando outros custos operacionais"},
     "total": numero
   }
   SOMA DOS VALORES DEVE SER IGUAL AO total. CUSTO DE ADMINISTRACAO MAX 15%.

   7. **EQUIPE** - ARRAY JSON DE MEMBROS:
   [
     {"nome": "Nome completo", "funcao": "Funcao no projeto", "qualificacao": "Formacao e experiencia", "dedicacao": "horas semanais"},
     {"nome": "...", "funcao": "...", "qualificacao": "...", "dedicacao": "..."}
   ]
   GERAR 3-5 MEMBROS COM FUNCOES DISTINTAS (COORDENADOR, ASSISTENTE, CONSULTOR, ETC).

---

INSTRUCOES DE FUNDAMENTACAO:
A secao de "Justificativa" deve OBRIGATORIAMENTE utilizar os dados de busca fornecidos acima. Cite estatisticas, relatorios ou dados especificos das fontes encontradas para validar a necessidade do projeto. Quando houver dados conflitantes entre as fontes, priorize os mais recentes e de fontes oficiais.

DIRETRIZES DE ESTILO E RESTRICOES "ANTI-IA":
Para garantir alta densidade tecnica e fluidez organica, obedece estritamente as seguintes regras:
1. **Variacao Sintatica (Alta Explosividade):** Alterne o ritmo da leitura. Use frases curtas para enfatizar problemas e periodos compostos para detalhar metodologias.
2. **Tom Impoessoal e Tecnico:** Escreva em 3a pessoa do singular. O tom deve ser pragmatica, direto e institucional.
3. **Proibicao Absoluta de Cliches:** NUNCA utilize as seguintes palavras ou sinonimos: ${PROIBIDOS}
4. **Objetividade:** Eh estritamente proibido incluir introducoes amigaveis, saudacoes ou conclusoes reflexivas e moralistas. Entregue apenas a estrutura tecnica solicitada.

---

Retorne em formato JSON com a estrutura:
{
  "resumoExecutivo": "EXATAMENTE 5 PARAGRAFOS. Cada paragrafo separado por \\n\\n",
  "justificativa": "EXATAMENTE 4-5 PARAGRAFOS. Citar fontes como [1], [2] no texto.",
  "objetivos": "JSON STRINGIFY do objeto {geral: string, especificos: array}",
  "metodologia": "EXATAMENTE 6 PARAGRAFOS. Cada paragrafo separado por \\n\\n",
  "resultadosEsperados": "JSON STRINGIFY com {curtoPrazo, medioPrazo, longoPrazo}",
  "cronograma": "Texto describindo meses e fases",
  "orcamentoDetalhado": "JSON STRINGIFY com {administracao, divulgacao, equipe, materiais, outros, total}",
  "valorSolicitado": numero,
  "prazoMeses": numero,
  "equipe": "JSON STRINGIFY do array de membros [{nome, funcao, qualificacao, dedicacao}]",
  "criteriosAtendidos": ["..."],
  "criteriosPendentes": ["..."],
  "scoreCompliance": numero_0_a_100,
  "fontes": ["[1] Titulo - URL", "[2] Titulo - URL", ...]
}`;
}

export function gerarPromptSecao(
  secao: string,
  edil: EditalContext,
  proposal: UserProposal,
  secoesAnteriores?: Partial<PropostaCompleta>,
  searchResults?: SearchResult[]
): string {
  const valoresFinanciaveis = edil.itensFinanciaveis?.join('\n') || 'Nao especificado';
  const criterios = edil.criteriosAvaliacao?.join('\n') || 'Nao especificado';
  const areas = edil.areasTematicas?.join(', ') || 'Nao especificada';
  const fontesBusca = searchResults ? formatarFontes(searchResults) : 'Nenhuma busca realizada.';

  const secaoInstrucoes: Record<string, string> = {
    resumoExecutivo: 'Gere um resumo executive de 2-3 paragrafos que apresente o projeto de forma objetiva, destacando a relevancia, objetivos principais e resultados esperados.',
    justificativa: 'Gere uma justificativa detalhada que demonstre a necessidade do projeto. CITE EXPLICITAMENTE as fontes da busca usando [1], [2], etc.',
    objetivos: 'Gere o objetivo geral e objetivos especificos do projeto, seguindo a estrutura: Objetivo Geral + 3-5 Objetivos Especificos (formato SMARTER).',
    metodologia: 'Gere uma metodologia detalhada incluindo: abordagem, etapas, metodos de coleta de dados, analise, e cronograma de atividades.',
    resultadosEsperados: 'Gere os resultados esperados em 3 horizontes temporais (curto prazo ate 12 meses, medio prazo 1-3 anos, longo prazo 3+ anos). Para cada horizonte: descricao e 2-3 indicadores com metas.',
    cronograma: 'Gere um cronograma detalhado em formato de tabela com etapas, meses, atividades principais e marcos.',
    orcamentoDetalhado: 'Gere o orcamento detalhado com categorias: administracao (max 15%), divulgacao, equipe, materiais, outros. Para cada categoria: valor em reais e justificativa. Total deve ser a soma.',
    equipe: 'Gere a equipe do projeto com 3-5 membros. Para cada membro: nome, funcao, qualificacao relevante e dedicacao em horas semanais.',
  };

  let contextoAdicional = '';
  if (secoesAnteriores) {
    const tituloProj = proposal.titulo;
    const areaProj = proposal.areaAtuacao || '';
    contextoAdicional = `\n\n## SECOES ANTERIORES (para coerencia)\nTitulo do projeto: ${tituloProj}\nArea: ${areaProj}\n${secoesAnteriores.resumoExecutivo ? `Resumo Executivo ja gerado:\n${secoesAnteriores.resumoExecutivo}\n` : ''}${secoesAnteriores.justificativa ? `Justificativa ja gerada:\n${secoesAnteriores.justificativa}\n` : ''}${secoesAnteriores.objetivos ? `Objetivos ja definidos:\n${secoesAnteriores.objetivos}\n` : ''}`;
  }

  return `ATUE COMO um especialista senior em formulacao de projetos tecnicos, captação de recursos e escrita para editais publicos e privados.

A TAREFA:
Desenvolva a secao "${secao}" de um projeto executivo focado nos seguintes parametros:
* **Area de Atuacao:** ${areas}
* **Tema Especifico:** ${proposal.titulo}
* **Publico-Alvo:** ${proposal.areaAtuacao || 'Nao especificado'}

DADOS DE BUSCA (fontes reais para fundamentacao):
${fontesBusca}

CONTEXTO DO EDITAL:
- Titulo: ${edil.titulo}
- Orgao: ${edil.orgao}
- Valor disponivel: ${edil.valor ? `R$ ${edil.valor.toLocaleString('pt-BR')}` : 'Nao especificado'}
- Itens financiados: ${valoresFinanciaveis}
- Criterios de avaliacao: ${criterios}

PROPOSTA DO USUARIO:
- Titulo: ${proposal.titulo}
- Descricao: ${proposal.descricao}
- Area de atuacao: ${proposal.areaAtuacao || 'Nao especificada'}
- Proposta detalhada: ${proposal.propostaUsuario}${contextoAdicional}

---

DIRETRIZES DE ESTILO E RESTRICOES "ANTI-IA":
1. **Variacao Sintatica:** Alterne o ritmo da leitura.
2. **Tom Impoessoal e Tecnico:** Escreva em 3a pessoa do singular.
3. **Proibicao Absoluta de Cliches:** NUNCA utilize: ${PROIBIDOS}
4. **Objetividade:** Sem introducoes amigaveis ou conclusoes moralistas.

${secaoInstrucoes[secao] || 'Gere o conteudo da secao.'}

Retorne em JSON:
{
  "conteudo": "...",
  "scoreCompliance": numero_0_a_100
}`;
}

export function gerarPromptPolimento(texto: string, tipo: 'completo' | 'secao'): string {
  return `Polir o seguinte texto ${tipo === 'completo' ? 'de proposta completa' : 'de secao'} para formato Markdown profissional, sem tags HTML ou elementos de UI.

Texto a polir:
${texto}

Retorne apenas o texto polido em Markdown puro.`;
}