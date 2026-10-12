import { obterClienteOpenAI, obterModelo } from '../ai/client';
import { personaDoRedator, ehEditalDePesquisa } from '../ai/persona-edital';
import { buscarDadosProjetoMCP } from '../ai/tavily-mcp.client';
import { buscarContextoRAG, formatarContextoRAG } from '../rag/rag-service';
import { PromptRepository } from '../database/repositories/prompt.repository';

export interface EditalContexto {
  titulo: string;
  orgao: string;
  valor?: number;
  valorMax?: number;
  prazoMeses?: number;
  objetivo: string;
  criteriosAvaliacao: string[];
  itensFinanciaveis: string[];
  elegibilidade: string[];
  secoesRequeridas: string[];
  areasTematicas?: string[];
}

export interface ProponenteContexto {
  nome: string;
  cnpj: string;
  historico: string;
  projetosAnteriores: string[];
  certificacoes: string[];
  capacidadeTecnica: string;
}

/** null = não informado; nunca estimar. */
export interface MetricasContexto {
  publicoAlvo: string;
  localizacao: string;
  duracaoMeses: number;
  beneficiariosDiretos: number | null;
  beneficiariosIndiretos: number | null;
  produtosEntregues: string[];
  indicadoresImpacto: string[];
}

export interface ContextoGeracao {
  edital: EditalContexto;
  proponente: ProponenteContexto;
  metricas: MetricasContexto;
  proposta: { titulo: string; descricao: string; areaAtuacao: string; propostaUsuario: string };
  pesquisa: boolean;
  persona: string;
  instrucoesExtras: string;
  fontes: string;
  referenciasInternas: string;
}

export class ProponenteAusenteError extends Error {
  constructor() {
    super('Preencha o nome do proponente (aba Dados do proponente) antes de gerar o projeto.');
  }
}

export function paraListaDeTexto(valor: unknown): string[] {
  if (!valor) return [];
  if (Array.isArray(valor)) return valor.filter((v): v is string => typeof v === 'string');
  if (typeof valor === 'string') return [valor];
  return [];
}

export function elegibilidadeParaLista(el: any): string[] {
  if (!el) return [];
  if (typeof el !== 'object' || Array.isArray(el)) return paraListaDeTexto(el);
  const partes: string[] = [];
  if (el.tiposProponentes?.length) partes.push(`Proponentes: ${el.tiposProponentes.join(', ')}`);
  if (el.requisitos?.length) partes.push(`Requisitos: ${el.requisitos.join(', ')}`);
  if (el.restricoes?.length) partes.push(`Restrições: ${el.restricoes.join(', ')}`);
  if (el.restritoA) partes.push(`Participação restrita a: ${el.restritoA}`);
  if (el.observacoes) partes.push(`Observações: ${el.observacoes}`);
  return partes;
}

export function proponenteDoProjeto(dados: any): ProponenteContexto {
  if (!dados?.nomeProponente?.trim()) throw new ProponenteAusenteError();
  const lista = (v: unknown) => (Array.isArray(v) ? (v as string[]) : []);
  return {
    nome: dados.nomeProponente,
    cnpj: dados.cnpjCpf || '',
    historico: dados.historico || '',
    projetosAnteriores: lista(dados.projetosAnteriores),
    certificacoes: lista(dados.certificacoes),
    capacidadeTecnica: dados.capacidadeTecnica || '',
  };
}

export function editalDoProjeto(edital: any): EditalContexto {
  const analise = edital?.analiseIA || {};
  let areas: string[] | undefined;
  try { areas = edital?.areasTematicas ? JSON.parse(edital.areasTematicas) : undefined; } catch { areas = undefined; }
  return {
    titulo: edital?.titulo || '',
    orgao: edital?.orgao || '',
    valor: edital?.valor ? Number(edital.valor) : undefined,
    valorMax: edital?.valorMax ? Number(edital.valorMax) : undefined,
    prazoMeses: edital?.prazoMeses ? Number(edital.prazoMeses) : undefined,
    objetivo: analise.objetivo || '',
    criteriosAvaliacao: paraListaDeTexto(analise.criteriosAvaliacao),
    itensFinanciaveis: paraListaDeTexto(analise.itensFinanciaveis),
    elegibilidade: elegibilidadeParaLista(analise.elegibilidade),
    secoesRequeridas: paraListaDeTexto(analise.secoesRequeridas),
    areasTematicas: areas,
  };
}

/** Extrai métricas explícitas na descrição do projeto; o que não constar fica vazio ou null. */
export async function extrairMetricas(titulo: string, descricao: string, duracaoMeses: number): Promise<MetricasContexto> {
  const vazio: MetricasContexto = {
    publicoAlvo: '', localizacao: '', duracaoMeses, beneficiariosDiretos: null,
    beneficiariosIndiretos: null, produtosEntregues: [], indicadoresImpacto: [],
  };
  if (!descricao.trim()) return vazio;
  const resp = await obterClienteOpenAI().chat.completions.create({
    model: obterModelo('mini'),
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [{
      role: 'user',
      content: `Extraia do texto abaixo as métricas do projeto. Extraia SOMENTE o que estiver explícito. NÃO estime nem invente: o que não constar deve ficar null (números) ou vazio (texto/lista).

Título: ${titulo}
Descrição: ${descricao}

Retorne só JSON: {"publicoAlvo":"","localizacao":"","beneficiariosDiretos":null,"beneficiariosIndiretos":null,"produtosEntregues":[],"indicadoresImpacto":[]}`,
    }],
  });
  const b = JSON.parse(resp.choices[0]?.message?.content || '{}');
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);
  return {
    publicoAlvo: b.publicoAlvo || '',
    localizacao: b.localizacao || '',
    duracaoMeses,
    beneficiariosDiretos: num(b.beneficiariosDiretos),
    beneficiariosIndiretos: num(b.beneficiariosIndiretos),
    produtosEntregues: Array.isArray(b.produtosEntregues) ? b.produtosEntregues : [],
    indicadoresImpacto: Array.isArray(b.indicadoresImpacto) ? b.indicadoresImpacto : [],
  };
}

const NI = '(não informado: não inventar; escrever de forma genérica ou usar [PREENCHER: ...])';
const lista = (itens: string[]) => (itens.length ? itens.map(i => `- ${i}`).join('\n') : NI);

/** Texto do contexto enviado à IA (também serve de base para conferir números). */
export function textoDoContexto(ctx: ContextoGeracao): string {
  const e = ctx.edital;
  const p = ctx.proponente;
  const m = ctx.metricas;
  const n = (v: number | null) => (v === null ? NI : String(v));
  return `EDITAL
Título: ${e.titulo}
Órgão: ${e.orgao}
Valor total disponível: ${e.valor ? `R$ ${e.valor.toLocaleString('pt-BR')}` : 'não especificado'}
Valor máximo por projeto: ${e.valorMax ? `R$ ${e.valorMax.toLocaleString('pt-BR')}` : 'não especificado'}
Prazo máximo: ${e.prazoMeses ? `${e.prazoMeses} meses` : 'não especificado'}
Áreas temáticas: ${e.areasTematicas?.join(', ') || 'não especificadas'}
Objetivo do edital: ${e.objetivo || 'não especificado'}
Critérios de avaliação:
${lista(e.criteriosAvaliacao)}
Itens financiáveis:
${lista(e.itensFinanciaveis)}
Elegibilidade:
${lista(e.elegibilidade)}

PROPONENTE
Nome: ${p.nome}
CNPJ/CPF: ${p.cnpj || NI}
Histórico: ${p.historico || NI}
Projetos anteriores:
${lista(p.projetosAnteriores)}
Certificações:
${lista(p.certificacoes)}
Capacidade técnica: ${p.capacidadeTecnica || NI}

PROJETO
Título: ${ctx.proposta.titulo}
Descrição: ${ctx.proposta.descricao || NI}
Área de atuação: ${ctx.proposta.areaAtuacao || NI}
Proposta do usuário: ${ctx.proposta.propostaUsuario || NI}
Público-alvo: ${m.publicoAlvo || NI}
Localização: ${m.localizacao || NI}
Duração: ${m.duracaoMeses} meses
Beneficiários diretos: ${n(m.beneficiariosDiretos)}
Beneficiários indiretos: ${n(m.beneficiariosIndiretos)}
Produtos:
${lista(m.produtosEntregues)}
Indicadores:
${lista(m.indicadoresImpacto)}`;
}

/** Monta, uma vez, tudo o que o gerador e o "aprimorar" precisam. Lança ProponenteAusenteError sem nome do proponente. */
export async function montarContextoGeracao(projeto: any): Promise<ContextoGeracao> {
  const proponente = proponenteDoProjeto(projeto.dadosProponente);
  const edital = editalDoProjeto(projeto.edital);
  const proposta = {
    titulo: projeto.titulo || '',
    descricao: projeto.descricao || '',
    areaAtuacao: projeto.areaAtuacao || '',
    propostaUsuario: projeto.propostaUsuario || projeto.descricao || '',
  };
  const duracao = Number(projeto.prazoMeses) || edital.prazoMeses || 12;

  const [metricas, fontes, referencias, extras] = await Promise.all([
    extrairMetricas(proposta.titulo, proposta.propostaUsuario, duracao),
    buscarDadosProjetoMCP(proposta.titulo, proposta.areaAtuacao)
      .then(r => r.results.map((x, i) => `[${i + 1}] ${x.title} - ${x.url}\n"${x.content.slice(0, 400)}"`).join('\n\n'))
      .catch(() => ''),
    buscarContextoRAG(edital.titulo, edital.objetivo, edital.areasTematicas || [])
      .then(r => (r.chunks.length ? formatarContextoRAG(r.chunks) : ''))
      .catch(() => ''),
    new PromptRepository().getAtivo('projetos_cultura', 'instrucoes_adicionais').catch(() => null),
  ]);

  return {
    edital,
    proponente,
    metricas,
    proposta,
    pesquisa: ehEditalDePesquisa(edital),
    persona: personaDoRedator(edital),
    instrucoesExtras: (extras || '').slice(0, 2000),
    fontes,
    referenciasInternas: referencias,
  };
}
