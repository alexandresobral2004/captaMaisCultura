/**
 * Engine de Geração de Propostas com Restrições Rígidas
 * 
 * Este módulo implementa um motor de escrita técnica para propostas de editais,
 * seguindo princípios de engenharia de requisitos ao invés de redação criativa.
 * 
 * Diretrizes:
 * - Norma culta sem prosa empolada
 * - Voz ativa e assertividade
 * - Simplicidade objetiva (Plain Language)
 * - Ultra-especificidade macro e micro
 * - Estrutura previsível por número de parágrafos
 */

import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';

/**
 * Schema estrito de saída para garantir que a IA divida o texto de forma estruturada.
 * Cada seção é retornada como array de parágrafos com metadados de validação.
 */
export const SectionOutputSchema = z.object({
  paragraphs: z.array(z.string()).describe('Lista de parágrafos ordenados que compõem a seção.'),
  metadata: z.object({
    wordCount: z.number().describe('Contagem total de palavras na seção'),
    paragraphCount: z.number().describe('Número total de parágrafos'),
    dataSourcesUsed: z.array(z.string()).describe('Fontes de dados ou estatísticas citadas no texto.')
  })
});

export type SectionOutput = z.infer<typeof SectionOutputSchema>;

/**
 * Configuração de uma seção com suas restrições estruturais.
 */
interface SectionConfig {
  minP: number;
  maxP: number;
  instruction: string;
  structuralFunctions: string[];
}

/**
 * Contexto do edital para geração de propostas.
 */
export interface EditalContext {
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

/**
 * Contexto da instituição proponente (RAG).
 */
export interface InstitutionContext {
  nome: string;
  cnpj: string;
  historico: string;
  projetosAnteriores: string[];
  certificacoes: string[];
  capacidadeTecnica: string;
}

/**
 * Métricas alvo do projeto.
 */
export interface TargetMetrics {
  publicoAlvo: string;
  localizacao: string;
  duracaoMeses: number;
  beneficiariosDiretos: number;
  beneficiariosIndiretos: number;
  produtosEntregues: string[];
  indicadoresImpacto: string[];
}

/**
 * Lista de buzzwords proibidas - filtro de rejeição semântica.
 * Estas palavras demonstram amadorismo técnico e consomem caracteres preciosos.
 */
const FORBIDDEN_BUZZWORDS = [
  // Clichês de IA
  'revolucionário', 'revolucionaria', 'revolucionária',
  'maravilhoso', 'maravilhosa',
  'incrível', 'incrivel',
  'único', 'unica', 'única',
  'espetacular',
  'mágico', 'magico', 'mágica', 'magica',
  'extraordinário', 'extraordinaria', 'extraordinária',
  'fantástico', 'fantastica', 'fantástica',
  'impressionante',
  'notável', 'notavel',
  'excepcional',
  'brilhante',
  'inovador', 'inovadora', // Usar apenas com comprovação
  'disruptivo', 'disruptiva',
  'transformador', 'transformadora',

  // Frases feitas de IA
  'no cenário atual', 'no cenario atual',
  'em um mundo', 'num mundo',
  'é de suma importância', 'eh de suma importancia', 'é de suma importancia', 'eh de suma importância',
  'vale ressaltar', 'vale destacar',
  'importante mencionar',
  'ao longo da história', 'ao longo da historia',
  'desde os primórdios', 'desde os primordios',
  'na era contemporânea', 'na era contemporanea',
  'cada vez mais',
  'grande parte',
  'diversos', 'diversas',
  'vários', 'varios', 'várias', 'varias',
  'muitos', 'muitas',
  'alguns', 'algumas',
  'certo', 'certa', 'certos', 'certas', // Quando vago

  // Adjetivação vazia
  'belo', 'bela', 'belos', 'belas',
  'lindo', 'linda', 'lindos', 'lindas',
  'grande', 'grandes', // Quando não quantificado
  'pequeno', 'pequena', 'pequenos', 'pequenas', // Quando não quantificado
  'amplo', 'ampla', 'amplos', 'amplas', // Quando não especificado
  'profundo', 'profunda', 'profundos', 'profundas', // Quando não especificado

  // Termos de incerteza
  'pretende-se', 'busca-se', 'objetiva-se', // Preferir voz ativa
  'espera-se', 'acredita-se',
  'poderá', 'podera', 'poderiam',
  'talvez', 'possivelmente', 'provavelmente',
  'tentar', 'buscar', 'almejar', // Preferir verbos de ação direta

  // Metáforas e linguagem lírica
  'tesouro', 'joia', 'pérola', 'perola',
  'caminho', 'trajetória', 'trajetoria', 'jornada',
  'ponte', 'elo', 'vínculo', 'vinculo',
  'semente', 'germinar', 'florescer',
  'alavancar', 'alavancagem',
  'sinergia', 'sinérgico', 'sinergico', 'sinérgica', 'sinergica',
  'ecossistema', // Quando usado de forma vaga
  'holístico', 'holistica', 'holística',
  '360 graus', '360°',
  'mindset',
  'know-how',
  'benchmark',
  'stakeholders', // Preferir "partes interessadas"
  'deliverables', // Preferir "produtos entregáveis"
  'insight', 'insights', // Preferir "análise", "compreensão"
].map(w => w.toLowerCase());

/**
 * Fontes de dados confiáveis para citação estatística.
 * A IA só deve citar estatísticas se forem explicitamente injetadas.
 */
const TRUSTED_DATA_SOURCES = [
  'IBGE', 'Instituto Brasileiro de Geografia e Estatística',
  'IPEA', 'Instituto de Pesquisa Econômica Aplicada',
  'WHO', 'OMS', 'Organização Mundial da Saúde', 'Organizacao Mundial da Saude',
  'UNESCO',
  'UNICEF',
  'Banco Mundial',
  'Ministério da Educação', 'Ministerio da Educacao', 'MEC',
  'Ministério da Saúde', 'Ministerio da Saude', 'MS',
  'Ministério da Cultura', 'Ministerio da Cultura', 'MinC',
  'FINEP', 'Financiadora de Estudos e Projetos',
  'CNPq', 'Conselho Nacional de Desenvolvimento Científico e Tecnológico',
  'CAPES', 'Coordenação de Aperfeiçoamento de Pessoal de Nível Superior',
  'DataSUS', 'Datasus',
  'PNAD', 'Pesquisa Nacional por Amostra de Domicílios',
  'IDEB', 'Índice de Desenvolvimento da Educação Básica',
];

/**
 * Engine de geração de propostas com restrições rígidas de qualidade.
 * 
 * Este engine aplica regras severas de escrita técnica para garantir
 * que as propostas geradas atendam aos critérios de aprovação de bancas
 * avaliadoras de editais públicos e privados.
 */
export class ProposalWithRigidConstraintsEngine {

  private readonly temperature: number = 0.2;
  private readonly model: string = 'gpt-4o-mini';

  /**
   * Gera uma seção específica do projeto aplicando regras severas de escrita técnica.
   * 
   * @param sectionName - Nome da seção a ser gerada ('Justificativa' | 'Metodologia' | 'Objetivos')
   * @param edictContext - Contexto do edital (título, órgão, critérios, etc.)
   * @param institutionContext - Contexto da instituição proponente (RAG)
   * @param targetMetrics - Métricas alvo do projeto
   * @returns Promise<SectionOutput> com os parágrafos gerados e metadados
   * @throws Error se a geração falhar ou violar restrições estruturais
   */
  async generateSection(
    sectionName: 'Justificativa' | 'Metodologia' | 'Objetivos',
    edictContext: string,
    institutionContext: string,
    targetMetrics: string
  ): Promise<SectionOutput> {

    const promptConfig = this.getSectionConfig(sectionName);

    const systemPrompt = `Você é um Engenheiro de Projetos de Captação de Recursos Sênior. 
Sua escrita deve ser rigorosamente formal, culta, direta e ultra-específica.

DIRETRIZES TÉCNICAS IMPERATIVAS DE ESCRITA:
1. NUNCA use adjetivos subjetivos (ex: maravilhoso, incrível, inovação revolucionária). Substitua por fatos e métricas.
2. Escreva sempre na VOZ ATIVA e utilizando verbos de ação direta no presente ou infinitivo.
3. Cada parágrafo deve focar exclusivamente em sua respectiva sub-função estrutural.
4. Você deve gerar EXATAMENTE entre ${promptConfig.minP} e ${promptConfig.maxP} parágrafos.
5. Injete dados estatísticos, numéricos e geográficos para provar cada argumento técnico.
6. Frases curtas (máximo 25 palavras por período). Se um avaliador precisar ler a mesma frase duas vezes para entender, o texto falhou.
7. Use norma culta sem prosa empolada, metáforas ou passagens líricas.
8. Evite voz passiva e termos de incerteza ("pretende-se fazer", "busca-se tentar"). Use "O projeto capacita", "Instalar", "Desenvolver".
9. Você está ABSOLUTAMENTE PROIBIDO de utilizar as seguintes palavras ou expressões (o validador automático irá rejeitar o texto caso utilize qualquer uma delas): ${FORBIDDEN_BUZZWORDS.join(', ')}.`;

    const model = new ChatOpenAI({
      model: this.model,
      temperature: this.temperature,
      apiKey: process.env.OPENAI_API_KEY,
    });

    const modelWithSchema = model.withStructuredOutput(SectionOutputSchema, {
      name: 'section_generation',
    });

    let attempts = 0;
    const maxAttempts = 3;
    let feedback = '';

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const userPrompt = `Com base no contexto fornecido, construa a seção de **${sectionName}**.

CONTEXTO DO EDITAL:
${edictContext}

CONTEXTO DA INSTITUIÇÃO PROPOENTE (RAG):
${institutionContext}

MÉTRICAS DO PROJETO A SEREM ATINGIDAS:
${targetMetrics}

INSTRUÇÃO DA SEÇÃO:
${promptConfig.instruction}

ESTRUTURA ESPERADA:
${promptConfig.structuralFunctions.map((fn, i) => `Parágrafo ${i + 1}: ${fn}`).join('\n')}

IMPORTANTE: 
- Cada parágrafo deve ter entre 3-5 frases completas.
- Cite fontes de dados explicitamente quando usar estatísticas.
- Não use nenhuma das buzzwords proibidas na lista de validação.
${feedback ? `\nATENÇÃO: A tentativa anterior falhou na validação de qualidade com o seguinte erro: "${feedback}". Corrija esse ponto e evite reincidir no erro.` : ''}`;

        const result = await modelWithSchema.invoke([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]);

        // Guardrail de validação pós-geração (Defensive Programming)
        this.validateOutputConstraints(result, promptConfig.minP, promptConfig.maxP);

        return result;
      } catch (error: any) {
        console.warn(`[Engine] Tentativa ${attempts} de ${maxAttempts} falhou para a seção ${sectionName}: ${error.message}`);
        feedback = error.message;
        if (attempts >= maxAttempts) {
          throw new Error(`Falha na geração de proposta após ${maxAttempts} tentativas. Último erro: ${error.message}`);
        }
      }
    }

    throw new Error('Erro inesperado no loop de tentativas');
  }

  /**
   * Obtém a configuração estrutural para uma seção específica.
   */
  private getSectionConfig(section: string): SectionConfig {
    const configs: Record<string, SectionConfig> = {
      Justificativa: {
        minP: 4,
        maxP: 5,
        instruction: `Escreva em 4 a 5 parágrafos estruturados seguindo esta ordem:
1. Diagnóstico do problema com dados estatísticos oficiais (IBGE, IPEA, WHO, etc.) delimitando o problema geográfico e social.
2. O Gap atual do ecossistema: por que as soluções atuais falham ou por que o poder público não consegue suprir essa demanda específica.
3. A solução proposta pelo projeto: apresentação clara do projeto como a resposta exata ao gap apresentado.
4. A capacidade técnica institucional: histórico curto de execução e autoridade da instituição proponente.
5. Impacto e sustentabilidade: o legado do projeto após o término do recurso.`,
        structuralFunctions: [
          'Diagnóstico com dados estatísticos oficiais',
          'Gap das soluções atuais',
          'Apresentação da solução do projeto',
          'Capacidade técnica institucional (RAG)',
          'Impacto futuro e sustentabilidade'
        ]
      },
      Metodologia: {
        minP: 3,
        maxP: 4,
        instruction: `Escreva em 3 a 4 parágrafos estruturados seguindo esta ordem:
1. Fase Pré-Executiva: mobilização, contratação, compras e preparação.
2. Fase Executiva Core: como as atividades principais serão entregues no dia a dia.
3. Fase Pós-Executiva/Métrica: processo de avaliação de resultados, auditoria e prestação de contas.
4. (Opcional) Cronograma físico-financeiro e marcos de entrega.`,
        structuralFunctions: [
          'Fase Pré-Executiva (mobilização, contratação, compras)',
          'Fase Executiva Core (atividades principais)',
          'Fase Pós-Executiva (avaliação, auditoria, prestação de contas)',
          'Cronograma físico-financeiro e marcos (opcional)'
        ]
      },
      Objetivos: {
        minP: 2,
        maxP: 10,
        instruction: `Escreva a seção de Objetivos em 2 a 10 parágrafos:
1. O primeiro parágrafo deve ser um texto de amarração conectando o objetivo geral aos objetivos específicos.
2. Cada parágrafo subsequente no array deve ser um objetivo específico individual seguindo a metodologia SMART (Específicos, Mensuráveis, Atingíveis, Relevantes e Temporais).
Não agrupe todos os objetivos específicos no mesmo parágrafo, retorne cada um deles como um item separado no array de parágrafos.`,
        structuralFunctions: [
          'Parágrafo de amarração conectando objetivo geral',
          'Objetivos específicos individuais (Bullets) seguindo metodologia SMART'
        ]
      }
    };
    return configs[section];
  }

  /**
   * Valida as restrições de saída da IA.
   * 
   * @param output - Saída gerada pela IA
   * @param min - Número mínimo de parágrafos esperado
   * @param max - Número máximo de parágrafos esperado
   * @throws Error se violar restrições estruturais ou de qualidade
   */
  validateOutputConstraints(output: SectionOutput, min: number, max: number): void {
    const pCount = output.paragraphs.length;
    if (pCount < min || pCount > max) {
      throw new Error(`Violou restrição estrutural: Gerou ${pCount} parágrafos, esperado entre ${min} e ${max}.`);
    }

    // Heurística de Anti-Verbosity/Fluff Detection
    for (const paragraph of output.paragraphs) {
      const hasBuzzword = this.detectForbiddenBuzzwords(paragraph);
      if (hasBuzzword.found) {
        throw new Error(`Violou barreira de qualidade: O texto contém adjetivação proibida: "${hasBuzzword.word}"`);
      }
    }

    // Validação de especificidade: verificar se há dados numéricos
    for (const paragraph of output.paragraphs) {
      const hasSpecificity = this.validateSpecificity(paragraph);
      if (!hasSpecificity) {
        console.warn('Aviso: Parágrafo pode estar muito genérico (sem dados numéricos ou geográficos)');
      }
    }

    // Validação de tamanho de frase (máximo 25 palavras por período)
    for (const paragraph of output.paragraphs) {
      const longSentences = this.detectLongSentences(paragraph);
      if (longSentences.length > 0) {
        console.warn(`Aviso: ${longSentences.length} frase(s) excedem 25 palavras`);
      }
    }
  }

  /**
   * Detecta buzzwords proibidas em um texto.
   */
  private detectForbiddenBuzzwords(text: string): { found: boolean; word?: string } {
    const lowerText = text.toLowerCase();
    for (const buzzword of FORBIDDEN_BUZZWORDS) {
      const escaped = buzzword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(?<!\\p{L})${escaped}(?!\\p{L})`, 'ui');
      if (regex.test(lowerText)) {
        return { found: true, word: buzzword };
      }
    }
    return { found: false };
  }

  /**
   * Valida se o parágrafo contém dados específicos (números, porcentagens, localizações).
   */
  private validateSpecificity(paragraph: string): boolean {
    // Regex para detectar números, porcentagens, datas, localizações
    const hasNumbers = /\d+%|\d+\.?\d*|\d{4}|\[\d+\]/.test(paragraph);
    const hasLocation = /bairro|região|regiao|município|municipio|estado|cidade|local|área|area/i.test(paragraph);
    const hasTarget = /beneficiar|atender|alcançar|alcançar|público|publico|meta|indicador/i.test(paragraph);

    return hasNumbers || hasLocation || hasTarget;
  }

  /**
   * Detecta frases com mais de 25 palavras.
   */
  private detectLongSentences(paragraph: string): string[] {
    // Divide por pontuação de final de frase
    const sentences = paragraph.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
    const longSentences: string[] = [];

    for (const sentence of sentences) {
      const wordCount = sentence.split(/\s+/).length;
      if (wordCount > 25) {
        longSentences.push(sentence);
      }
    }

    return longSentences;
  }

  /**
   * Gera uma proposta completa com múltiplas seções.
   */
  async generateFullProposal(
    edictContext: EditalContext,
    institutionContext: InstitutionContext,
    targetMetrics: TargetMetrics
  ): Promise<{
    justificativa: SectionOutput;
    metodologia: SectionOutput;
    objetivos: SectionOutput;
  }> {
    const edictText = this.formatEdictContext(edictContext);
    const institutionText = this.formatInstitutionContext(institutionContext);
    const metricsText = this.formatTargetMetrics(targetMetrics);

    const [justificativa, metodologia, objetivos] = await Promise.all([
      this.generateSection('Justificativa', edictText, institutionText, metricsText),
      this.generateSection('Metodologia', edictText, institutionText, metricsText),
      this.generateSection('Objetivos', edictText, institutionText, metricsText),
    ]);

    return { justificativa, metodologia, objetivos };
  }

  /**
   * Formata o contexto do edital para o prompt.
   */
  private formatEdictContext(context: EditalContext): string {
    return `
Título: ${context.titulo}
Órgão: ${context.orgao}
${context.valor ? `Valor disponível: R$ ${context.valor.toLocaleString('pt-BR')}` : ''}
${context.valorMax ? `Valor máximo financiável: R$ ${context.valorMax.toLocaleString('pt-BR')}` : ''}
${context.prazoMeses ? `Prazo: ${context.prazoMeses} meses` : ''}
Áreas temáticas: ${context.areasTematicas?.join(', ') || 'Não especificada'}

Objetivo do Edital:
${context.objetivo}

Critérios de Avaliação:
${context.criteriosAvaliacao.join('\n')}

Itens Financiáveis:
${context.itensFinanciaveis.join('\n')}

Elegibilidade:
${context.elegibilidade.join('\n')}
`.trim();
  }

  /**
   * Formata o contexto da instituição para o prompt.
   */
  private formatInstitutionContext(context: InstitutionContext): string {
    return `
Nome: ${context.nome}
CNPJ: ${context.cnpj}
Histórico:
${context.historico}

Projetos Anteriores:
${context.projetosAnteriores.join('\n')}

Certificações:
${context.certificacoes.join('\n')}

Capacidade Técnica:
${context.capacidadeTecnica}
`.trim();
  }

  /**
   * Formata as métricas alvo para o prompt.
   */
  private formatTargetMetrics(metrics: TargetMetrics): string {
    return `
Público-Alvo: ${metrics.publicoAlvo}
Localização: ${metrics.localizacao}
Duração: ${metrics.duracaoMeses} meses
Beneficiários Diretos: ${metrics.beneficiariosDiretos}
Beneficiários Indiretos: ${metrics.beneficiariosIndiretos}

Produtos a Entregar:
${metrics.produtosEntregues.join('\n')}

Indicadores de Impacto:
${metrics.indicadoresImpacto.join('\n')}
`.trim();
  }
}

/**
 * Instância singleton do engine para uso compartilhado.
 */
export const proposalEngine = new ProposalWithRigidConstraintsEngine();
