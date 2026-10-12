import { obterClienteOpenAI, obterModelo } from '../ai/client';
import { textoDoContexto, type ContextoGeracao } from './contexto-geracao';
import {
  detectarProibidas, guiaDaSecao, limparHtml, numerosNaoSuportados, ondaDaSecao,
  semTags, tipoDaSecao, EXPRESSOES_PROIBIDAS,
} from './guias-secao';

export interface SecaoEntrada {
  id: string;
  chave: string;
  titulo: string;
  conteudo: string;
}

/** Chamada à IA (injetável para teste). Devolve o texto da resposta. */
export type ChamarIA = (sistema: string, usuario: string, temperatura: number) => Promise<string>;

export const chamarOpenAI: ChamarIA = async (sistema, usuario, temperatura) => {
  const resp = await obterClienteOpenAI().chat.completions.create({
    model: obterModelo('mini'),
    temperature: temperatura,
    messages: [{ role: 'system', content: sistema }, { role: 'user', content: usuario }],
  });
  return resp.choices[0]?.message?.content || '';
};

const MAX_TENTATIVAS = 3;
const PARALELO = 3;

function regrasGerais(ctx: ContextoGeracao): string {
  return `${ctx.persona}

REGRAS (obrigatórias):
1. Escreva em português, formal, técnico e objetivo, na voz ativa e em 3ª pessoa. Frases curtas.
2. Retorne SOMENTE o HTML da seção (<p>, <ul><li>, <h3>, <table>, <strong>), sem saudação, explicação ou cerca de código.
3. NADA INVENTADO: use apenas nomes, números, datas, parceiros, estatísticas e fontes que estejam no contexto ou no rascunho do usuário. Metas e quantidades (percentuais, número de pessoas, unidades, valores) que o usuário não informou NÃO podem ser criadas: escreva [PREENCHER: meta]. Onde faltar qualquer outro dado necessário, escreva [PREENCHER: o que falta].
4. Atenda aos critérios de avaliação e à elegibilidade do edital, respeitando valor máximo e prazo.
5. Proibido usar: ${EXPRESSOES_PROIBIDAS.join(', ')}.${ctx.instrucoesExtras ? `\n\nINSTRUÇÕES ADICIONAIS DA INSTITUIÇÃO:\n${ctx.instrucoesExtras}` : ''}`;
}

function blocoContexto(ctx: ContextoGeracao): string {
  return `${textoDoContexto(ctx)}${ctx.fontes ? `\n\nFONTES DE PESQUISA:\n${ctx.fontes}` : ''}${ctx.referenciasInternas ? `\n\nREFERÊNCIAS INTERNAS:\n${ctx.referenciasInternas}` : ''}`;
}

/** Base para conferir números: contexto + rascunhos do usuário. */
function baseDeNumeros(ctx: ContextoGeracao, secoes: SecaoEntrada[]): string {
  return `${blocoContexto(ctx)}\n${secoes.map(s => semTags(s.conteudo)).join('\n')}`;
}

function resumoDasOutras(textos: Record<string, string>, secoes: SecaoEntrada[], excetoChave: string): string {
  return secoes
    .filter(s => s.chave !== excetoChave && semTags(textos[s.chave] || ''))
    .map(s => `## ${s.titulo}\n${semTags(textos[s.chave]).slice(0, 700)}`)
    .join('\n\n');
}

async function escreverComValidacao(
  chamar: ChamarIA, sistema: string, usuarioBase: string, temperatura: number,
): Promise<{ html: string; proibidasRestantes: string[] }> {
  let feedback = '';
  let html = '';
  let proibidas: string[] = [];
  for (let i = 0; i < MAX_TENTATIVAS; i++) {
    html = limparHtml(await chamar(sistema, usuarioBase + feedback, temperatura));
    proibidas = detectarProibidas(html);
    if (html && proibidas.length === 0) break;
    feedback = `\n\nA versão anterior foi recusada: ${html ? `usou expressões proibidas (${proibidas.join(', ')})` : 'veio vazia'}. Reescreva sem elas.`;
  }
  return { html, proibidasRestantes: proibidas };
}

async function emLotes<T>(itens: T[], tamanho: number, fn: (item: T) => Promise<void>) {
  for (let i = 0; i < itens.length; i += tamanho) {
    await Promise.all(itens.slice(i, i + tamanho).map(fn));
  }
}

export interface ResultadoGeracao {
  /** chave da seção → HTML (só as seções geradas) */
  secoes: Record<string, string>;
  avisos: string[];
}

/**
 * Gera as seções do projeto, uma por uma, em ondas (base → intermediárias → sínteses),
 * para que o texto seja coerente entre as seções. modo "vazias" não toca no que o usuário já escreveu.
 */
export async function gerarSecoes(
  ctx: ContextoGeracao,
  secoes: SecaoEntrada[],
  opcoes: { modo: 'vazias' | 'todas'; chamar?: ChamarIA },
): Promise<ResultadoGeracao> {
  const chamar = opcoes.chamar ?? chamarOpenAI;
  const sistema = regrasGerais(ctx);
  const contexto = blocoContexto(ctx);
  const numerosBase = baseDeNumeros(ctx, secoes);
  const textos: Record<string, string> = Object.fromEntries(secoes.map(s => [s.chave, s.conteudo]));
  const geradas: Record<string, string> = {};
  const avisos: string[] = [];

  const alvo = secoes.filter(s => opcoes.modo === 'todas' || !semTags(s.conteudo));

  for (const onda of [1, 2, 3] as const) {
    const daOnda = alvo.filter(s => ondaDaSecao(tipoDaSecao(s.titulo)) === onda);
    await emLotes(daOnda, PARALELO, async secao => {
      const tipo = tipoDaSecao(secao.titulo);
      const rascunho = semTags(secao.conteudo);
      const outras = resumoDasOutras(textos, secoes, secao.chave);
      const usuario = `${contexto}

SEÇÃO A ESCREVER: "${secao.titulo}"
Orientação para esta seção: ${guiaDaSecao(tipo, ctx.pesquisa)}
${rascunho ? `\nRASCUNHO DO USUÁRIO (incorpore e desenvolva, sem perder nenhuma informação): "${rascunho}"` : ''}
${outras ? `\nOUTRAS SEÇÕES DO PROJETO (mantenha coerência com elas):\n${outras}` : ''}

Escreva agora a seção "${secao.titulo}".`;

      const { html, proibidasRestantes } = await escreverComValidacao(chamar, sistema, usuario, 0.4);
      if (!html) {
        avisos.push(`Seção "${secao.titulo}": a IA não devolveu texto. Tente gerar de novo.`);
        return;
      }
      geradas[secao.chave] = html;
      textos[secao.chave] = html;
      if (proibidasRestantes.length) avisos.push(`Seção "${secao.titulo}": ainda tem expressões que o sistema evita (${proibidasRestantes.join(', ')}).`);
      const sem = numerosNaoSuportados(html, numerosBase);
      if (sem.length) avisos.push(`Seção "${secao.titulo}": confira estes números, que não estão no edital nem nos seus dados: ${sem.join(', ')}.`);
    });
  }
  return { secoes: geradas, avisos };
}

/**
 * Reescreve uma seção com variação de texto, mantendo fatos e números.
 * Com `pedido` em branco, foca nos critérios que a seção atende mal (`pendencias`).
 */
export async function aprimorarSecao(
  ctx: ContextoGeracao,
  secao: SecaoEntrada,
  outras: SecaoEntrada[],
  opcoes: { pedido?: string; pendencias?: string[]; chamar?: ChamarIA } = {},
): Promise<{ conteudoNovo: string; avisos: string[] }> {
  const chamar = opcoes.chamar ?? chamarOpenAI;
  const tipo = tipoDaSecao(secao.titulo);
  const atual = semTags(secao.conteudo) ? secao.conteudo : '';
  const outrasTexto = outras
    .filter(o => semTags(o.conteudo))
    .map(o => `## ${o.titulo}\n${semTags(o.conteudo).slice(0, 600)}`)
    .join('\n\n');
  const foco = opcoes.pedido?.trim()
    ? `PEDIDO DO USUÁRIO (siga-o): ${opcoes.pedido.trim()}`
    : opcoes.pendencias?.length
      ? `FOQUE em melhorar o atendimento a estes critérios do edital que a seção atende mal:\n${opcoes.pendencias.map(p => `- ${p}`).join('\n')}`
      : 'Melhore a clareza, a objetividade e o atendimento aos critérios de avaliação do edital.';

  const usuario = `${blocoContexto(ctx)}

SEÇÃO: "${secao.titulo}"
Orientação para esta seção: ${guiaDaSecao(tipo, ctx.pesquisa)}

TEXTO ATUAL:
${atual || '(vazio: escreva do zero)'}

${foco}
${outrasTexto ? `\nOUTRAS SEÇÕES (mantenha coerência):\n${outrasTexto}` : ''}

Reescreva a seção em outra estrutura e vocabulário, mantendo todos os fatos, números e metas do texto atual. Não acrescente números, nomes ou fontes novos.`;

  const { html } = await escreverComValidacao(chamar, regrasGerais(ctx), usuario, 0.4);
  if (!html) throw new Error('A IA não devolveu texto. Tente novamente.');
  const avisos: string[] = [];
  const sem = numerosNaoSuportados(html, `${blocoContexto(ctx)}\n${semTags(atual)}`);
  if (sem.length) avisos.push(`Confira estes números, que não estão no edital nem nos seus dados: ${sem.join(', ')}.`);
  return { conteudoNovo: html, avisos };
}

/** Quantos trechos [PREENCHER: ...] ainda faltam completar. */
export function contarPreencher(htmls: string[]): number {
  return htmls.reduce((n, h) => n + (h.match(/\[PREENCHER:/g)?.length || 0), 0);
}
