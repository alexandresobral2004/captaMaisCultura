import OpenAI from 'openai';
import { propostaCompletaSchema, secaoSchema, PropostaCompleta, SecaoGerada, propostaDinamicaSchema, PropostaDinamica } from './schema-projeto';
import { gerarPromptCompleto, gerarPromptSecao, gerarPromptPolimento, SearchResult, gerarPromptDinamico } from './prompts-projeto';
import { buscarDadosProjetoMCP } from './tavily-mcp.client';
import { buscarContextoRAG, formatarContextoRAG } from '../rag/rag-service';
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
}

interface UserProposal {
  titulo: string;
  descricao: string;
  areaAtuacao?: string;
  propostaUsuario: string;
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

export class ProposalWriter {
  private model: string;
  private promptRepository: PromptRepository;

  constructor(model: 'mini' | 'full' = 'mini') {
    this.model = model === 'mini' ? 'gpt-4o-mini' : 'gpt-4o';
    this.promptRepository = new PromptRepository();
  }

  async gerarPropostaCompleta(
    edil: EditalContext,
    proposal: UserProposal
  ): Promise<PropostaCompleta> {
    let searchResults: SearchResult[] = [];
    try {
      const searchResponse = await buscarDadosProjetoMCP(proposal.titulo, proposal.areaAtuacao);
      searchResults = searchResponse.results;
    } catch (e) {
      console.warn('Busca Tavily falhou, continuando sem search:', e);
    }

    // Tentar obter prompt customizado primeiro
    const promptCustomizado = await this.promptRepository.getAtivo('projetos_cultura', 'geracao_completa');
    const prompt = promptCustomizado || await gerarPromptCompleto(edil, proposal, searchResults);

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
    return propostaCompletaSchema.parse(parsed);
  }

  async gerarPropostaDinamica(
    edil: EditalContext,
    proposal: UserProposal,
    secoes: { id: string; chave: string; titulo: string; conteudo: string }[]
  ): Promise<PropostaDinamica> {
    let searchResults: SearchResult[] = [];
    try {
      const searchResponse = await buscarDadosProjetoMCP(proposal.titulo, proposal.areaAtuacao);
      searchResults = searchResponse.results;
    } catch (e) {
      console.warn('Busca Tavily falhou, continuando sem search:', e);
    }

    // Tentar obter prompt customizado primeiro
    const promptCustomizado = await this.promptRepository.getAtivo('projetos_cultura', 'geracao_dinamica');
    const prompt = promptCustomizado || await gerarPromptDinamico(edil, proposal, secoes, searchResults);

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
    return propostaDinamicaSchema.parse(parsed);
  }

  async gerarSecao(
    secao: string,
    edil: EditalContext,
    proposal: UserProposal,
    secoesAnteriores?: Partial<PropostaCompleta>
  ): Promise<SecaoGerada> {
    let searchResults: SearchResult[] = [];
    try {
      const searchResponse = await buscarDadosProjetoMCP(proposal.titulo, proposal.areaAtuacao);
      searchResults = searchResponse.results;
    } catch (e) {
      console.warn('Busca Tavily falhou, continuando sem search:', e);
    }

    // Tentar obter prompt customizado primeiro
    const promptCustomizado = await this.promptRepository.getAtivo('projetos_cultura', 'geracao_secao');
    const prompt = promptCustomizado || await gerarPromptSecao(secao, edil, proposal, secoesAnteriores, searchResults);

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
    return secaoSchema.parse(parsed);
  }

  async polirTexto(texto: string, tipo: 'completo' | 'secao' = 'secao'): Promise<string> {
    const prompt = gerarPromptPolimento(texto, tipo);

    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });

    return response.choices[0]?.message?.content || texto;
  }
}

export const proposalWriter = new ProposalWriter('mini');
export const proposalWriterFull = new ProposalWriter('full');