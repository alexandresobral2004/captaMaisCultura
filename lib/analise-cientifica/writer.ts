import OpenAI from 'openai';
import {
  projetoCientificoSchema,
  AnaliseConformidade,
  ProjetoCientifico,
  criarProjetoCientificoSchema,
  atualizarProjetoCientificoSchema
} from './schema';
import {
  gerarPromptPropostaCientifica,
  gerarPromptAnaliseConformidade,
  gerarPromptPolimento,
  gerarPromptAdequacao,
  SearchResult
} from './prompts';
import { PromptRepository } from '../database/repositories/prompt.repository';

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
  nivel?: string;
}

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

let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY não está definida. Configure a variável de ambiente.');
    }
    openai = new OpenAI({ apiKey });
  }
  return openai;
}

/**
 * Serviço para geração e análise de projetos científicos
 * INDEPENDENTE do sistema de cultura existente
 */
export class ProposalWriterCientifico {
  private model: string;
  private promptRepository: PromptRepository;

  constructor(model: 'mini' | 'full' = 'mini') {
    this.model = model === 'mini' ? 'gpt-4o-mini' : 'gpt-4o';
    this.promptRepository = new PromptRepository();
  }

  /**
   * Gera uma proposta científica completa
   */
  async gerarPropostaCompleta(
    edil: EditalContext,
    proposal: UserProposal,
    searchResults?: SearchResult[]
  ): Promise<Partial<ProjetoCientifico>> {
    // Tentar obter prompt customizado primeiro
    const promptCustomizado = await this.promptRepository.getAtivo('projetos_pesquisa', 'geracao_cientifica');
    const prompt = promptCustomizado || await gerarPromptPropostaCientifica(edil, proposal, searchResults);

    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.5,
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) throw new Error('Resposta vazia da IA');

    const parsed = JSON.parse(raw);
    
    // Normalizar objeto com os metadados necessários para aprovação no parser Zod
    const normalized = {
      id: proposal.id || crypto.randomUUID(),
      titulo: proposal.titulo,
      areaTematica: proposal.areaAtuacao || 'Outros',
      nivel: proposal.nivel || 'pesquisador',
      status: proposal.status || 'rascunho',
      dataCriacao: proposal.dataCriacao || new Date().toISOString(),
      dataAtualizacao: new Date().toISOString(),
      versao: proposal.versao || 1,
      ...parsed
    };

    return projetoCientificoSchema.parse(normalized);
  }

  /**
   * Analisa a conformidade de um projeto científico
   */
  async analisarConformidade(
    projeto: Partial<ProjetoCientifico>,
    edil: EditalContext
  ): Promise<AnaliseConformidade> {
    // Tentar obter prompt customizado primeiro
    const promptCustomizado = await this.promptRepository.getAtivo('projetos_pesquisa', 'analise_conformidade');
    const prompt = promptCustomizado || await gerarPromptAnaliseConformidade(projeto, edil);

    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) throw new Error('Resposta vazia da IA');

    const parsed = JSON.parse(raw);

    // Validar a estrutura da análise
    return {
      criteriosAvaliados: parsed.criteriosAvaliados || [],
      scoreGeral: parsed.scoreGeral || 0,
      feedback: parsed.feedback || [],
      recomendacoes: parsed.recomendacoes || [],
      dataAnalise: parsed.dataAnalise || new Date().toISOString(),
    };
  }

  /**
   * Polimento de seção específica
   */
  async polirSecao(
    secao: string,
    conteudo: string,
    tipoEdital: string
  ): Promise<string> {
    // Tentar obter prompt customizado primeiro
    const promptCustomizado = await this.promptRepository.getAtivo('projetos_pesquisa', 'polimento');
    const prompt = promptCustomizado || gerarPromptPolimento(secao, conteudo, tipoEdital);

    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) throw new Error('Resposta vazia da IA');

    return raw.trim();
  }

  /**
   * Analisa adequação do projeto ao edital
   */
  async analisarAdequacao(
    tituloProjeto: string,
    areaTematica: string,
    edil: EditalContext
  ): Promise<{
    adequado: boolean;
    scoreAdequacao: number;
    pontosAlinhamento: string[];
    pontosDesencontro: string[];
    recomendacao: string;
  }> {
    // Tentar obter prompt customizado primeiro
    const promptCustomizado = await this.promptRepository.getAtivo('projetos_pesquisa', 'analise_adequacao');
    const prompt = promptCustomizado || gerarPromptAdequacao(tituloProjeto, areaTematica, edil);

    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) throw new Error('Resposta vazia da IA');

    const parsed = JSON.parse(raw);
    return {
      adequado: parsed.adequado ?? false,
      scoreAdequacao: parsed.scoreAdequacao ?? 0,
      pontosAlinhamento: parsed.pontosAlinhamento || [],
      pontosDesencontro: parsed.pontosDesencontro || [],
      recomendacao: parsed.recomendacao || '',
    };
  }
}

/**
 * Serviço para gerenciamento de projetos científicos
 */
export class ProjetoCientificoService {
  private writer: ProposalWriterCientifico;

  constructor() {
    this.writer = new ProposalWriterCientifico('mini');
  }

  /**
   * Cria um novo projeto científico
   */
  async criarProjeto(dados: {
    titulo: string;
    areaTematica: string;
    nivel: string;
    editalId?: string;
  }): Promise<ProjetoCientifico> {
    const validado = criarProjetoCientificoSchema.parse(dados);

    const projeto: ProjetoCientifico = {
      id: crypto.randomUUID(),
      titulo: validado.titulo,
      areaTematica: validado.areaTematica,
      nivel: validado.nivel as any,
      status: 'rascunho',
      resumoExecutivo: '',
      justificativa: '',
      objetivos: '{"geral":"","especificos":[]}',
      metodologia: '',
      resultadosEsperados: '',
      referencias: '',
      titulosPersonalizados: '{}',
      pesquisadoresProponentes: '[]',
      secoesDinamicas: JSON.stringify([
        { id: 'resumo', chave: 'resumo', titulo: 'Resumo Executivo', conteudo: '', completa: false, editavel: true, ordem: 0 },
        { id: 'justificativa', chave: 'justificativa', titulo: 'Justificativa', conteudo: '', completa: false, editavel: true, ordem: 1 },
        { id: 'objetivos', chave: 'objetivos', titulo: 'Objetivos', conteudo: '', completa: false, editavel: true, ordem: 2 },
        { id: 'metodologia', chave: 'metodologia', titulo: 'Metodologia', conteudo: '', completa: false, editavel: true, ordem: 3 },
        { id: 'resultados', chave: 'resultados', titulo: 'Resultados Esperados', conteudo: '', completa: false, editavel: true, ordem: 4 },
        { id: 'referencias', chave: 'referencias', titulo: 'Referências Bibliográficas (ABNT)', conteudo: '', completa: false, editavel: true, ordem: 5 }
      ]),
      orcamento: null,
      cronograma: [],
      equipe: [],
      editalId: validado.editalId,
      palavrasChave: [],
      dataCriacao: new Date().toISOString(),
      dataAtualizacao: new Date().toISOString(),
      versao: 1,
    };

    return projeto;
  }

  /**
   * Atualiza um projeto científico
   */
  async atualizarProjeto(
    id: string,
    dados: Partial<ProjetoCientifico>
  ): Promise<Partial<ProjetoCientifico>> {
    const validado = atualizarProjetoCientificoSchema.parse(dados);

    return {
      ...validado,
      dataAtualizacao: new Date().toISOString(),
    };
  }

  /**
   * Gera proposta completa via IA
   */
  async gerarProposta(
    projeto: Partial<ProjetoCientifico>,
    edil: EditalContext
  ): Promise<Partial<ProjetoCientifico>> {
    const proposal: UserProposal = {
      titulo: projeto.titulo || '',
      descricao: projeto.resumoExecutivo || projeto.metodologia || projeto.justificativa || '',
      areaAtuacao: projeto.areaTematica,
      propostaUsuario: projeto.resumoExecutivo || '',
      resumoExecutivo: projeto.resumoExecutivo,
      justificativa: projeto.justificativa,
      objetivos: projeto.objetivos,
      metodologia: projeto.metodologia,
      resultadosEsperados: projeto.resultadosEsperados,
      referencias: projeto.referencias,
      analiseExistente: projeto.analise,
    };

    return await this.writer.gerarPropostaCompleta(edil, proposal);
  }

  /**
   * Analisa conformidade do projeto
   */
  async analisarConformidade(
    projeto: Partial<ProjetoCientifico>,
    edil: EditalContext
  ): Promise<AnaliseConformidade> {
    return await this.writer.analisarConformidade(projeto, edil);
  }

  /**
   * Analisa adequação ao edital
   */
  async analisarAdequacao(
    tituloProjeto: string,
    areaTematica: string,
    edil: EditalContext
  ): Promise<ReturnType<ProposalWriterCientifico['analisarAdequacao']>> {
    return await this.writer.analisarAdequacao(tituloProjeto, areaTematica, edil);
  }
}

// Instância singleton
let instance: ProjetoCientificoService | null = null;

export function getProjetoCientificoService(): ProjetoCientificoService {
  if (!instance) {
    instance = new ProjetoCientificoService();
  }
  return instance;
}
