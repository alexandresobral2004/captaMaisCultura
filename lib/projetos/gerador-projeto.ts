import { aceitaTemperatura, obterClienteOpenAI, obterModeloRedacao } from '../ai/client';
import { textoDoContexto, type ContextoGeracao } from './contexto-geracao';
import {
  citaSemReferencias, detectarProibidas, guiaDaSecao, justificarHtml, limparHtml, numerosNaoSuportados, ondaDaSecao,
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
  const modelo = obterModeloRedacao();
  const resp = await obterClienteOpenAI().chat.completions.create({
    model: modelo,
    ...(aceitaTemperatura(modelo) ? { temperature: temperatura } : { reasoning_effort: 'medium' as const }),
    messages: [{ role: 'system', content: sistema }, { role: 'user', content: usuario }],
  });
  return resp.choices[0]?.message?.content || '';
};

const MAX_TENTATIVAS = 3;
const PARALELO = 3;

function regrasGerais(ctx: ContextoGeracao): string {
  return `${ctx.persona}

COMO ESCREVER (obrigatório):
1. Escreva como o especialista descrito acima escreveria de próprio punho: com a vivência, o vocabulário e o olhar desse nicho, explicando o porquê das escolhas como quem conhece o campo por dentro. O avaliador deve sentir que quem escreveu faz esse trabalho.
2. Linguagem humanizada: texto corrido, natural e próximo, que mostre as pessoas e o território envolvidos. Alterne frases curtas e médias, use conectivos variados e evite jargão burocrático, fórmulas prontas e listas onde um parágrafo explica melhor.
3. Português do Brasil conforme a norma culta: concordância, regência, crase, acentuação e pontuação corretas. Revise o texto antes de entregar.
4. Não resuma: desenvolva cada ponto do rascunho e do edital com explicação, exemplo concreto do projeto e consequência esperada. Cada parágrafo deve ter de 4 a 7 frases. Nenhuma ideia do rascunho do usuário pode ficar de fora ou virar só um item de lista.
5. CITAÇÕES E REFERÊNCIAS: só cite uma fonte que esteja em FONTES DE PESQUISA ou REFERÊNCIAS INTERNAS, nunca de memória, e marque a citação no texto como [n], com o número da fonte. Se a seção tiver ao menos uma citação, termine-a com <h3>Referências</h3> e uma <ul> em formato ABNT (autor ou instituição, título, veículo, ano, URL e data de acesso quando houver na fonte) listando exatamente as fontes citadas, sem acrescentar dados que a fonte não traga. Sem citação, não crie a lista de referências.
6. Retorne SOMENTE o HTML da seção (<p>, <ul><li>, <h3>, <table>, <strong>), sem repetir o título da seção, sem saudação, explicação ou cerca de código.
7. NADA INVENTADO: use apenas nomes, números, datas, parceiros, estatísticas e fontes que estejam no contexto ou no rascunho do usuário. Metas e quantidades (percentuais, número de pessoas, unidades, valores) que o usuário não informou NÃO podem ser criadas: escreva [PREENCHER: meta]. Onde faltar qualquer outro dado necessário, escreva [PREENCHER: o que falta]. Desenvolver não é inventar: aprofunde o que foi dito, sem acrescentar fatos. Separe duas coisas: (a) SITUAÇÃO ATUAL do território, do público e da instituição (carências, falta de estrutura, demanda, reconhecimento da comunidade, histórico) só pode ser afirmada se estiver no contexto ou no rascunho; nunca deduza diagnóstico a partir do que o usuário pediu (pedir uma psicóloga não prova que hoje não há acompanhamento). Sem dado, escreva [PREENCHER: o que falta] ou fale do tema em termos gerais da área, sem atribuí-lo a este território. (b) O PLANO do projeto (como as oficinas serão organizadas, sequência pedagógica, instrumentos de registro, ordem das ações) pode ser detalhado com o saber técnico do nicho, no futuro do presente, desde que não contradiga o rascunho nem crie nomes, parceiros, quantidades ou prazos que o usuário não deu. Coloque o marcador no ponto exato da frase, sem comentar no texto que o dado falta (nada de "não foi informado", "deverá ser apresentado" ou "como essas informações não constam").
8. Atenda aos critérios de avaliação e à elegibilidade do edital, respeitando valor máximo e prazo.
9. Proibido usar: ${EXPRESSOES_PROIBIDAS.join(', ')}.${ctx.instrucoesExtras ? `\n\nINSTRUÇÕES ADICIONAIS DA INSTITUIÇÃO:\n${ctx.instrucoesExtras}` : ''}`;
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

const comparavel = (t: string) => semTags(t).toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');

/** Remove o título da seção quando a IA o repete no início do HTML (o editor já mostra o título). */
export function semTituloRepetido(html: string, titulo: string): string {
  const m = html.match(/^\s*<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>\s*/i);
  return m && comparavel(m[1]) === comparavel(titulo) ? html.slice(m[0].length) : html;
}

async function escreverComValidacao(
  chamar: ChamarIA, sistema: string, usuarioBase: string, temperatura: number, titulo: string,
): Promise<{ html: string; proibidasRestantes: string[] }> {
  let feedback = '';
  let html = '';
  let proibidas: string[] = [];
  for (let i = 0; i < MAX_TENTATIVAS; i++) {
    html = justificarHtml(semTituloRepetido(limparHtml(await chamar(sistema, usuarioBase + feedback, temperatura)), titulo));
    proibidas = detectarProibidas(html);
    const semRef = citaSemReferencias(html);
    if (html && proibidas.length === 0 && !semRef) break;
    feedback = `\n\nA versão anterior foi recusada: ${!html ? 'veio vazia' : [proibidas.length ? `usou expressões proibidas (${proibidas.join(', ')})` : '', semRef ? 'tem citações sem a lista <h3>Referências</h3> no fim' : ''].filter(Boolean).join(' e ')}. Corrija.`;
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

      const { html, proibidasRestantes } = await escreverComValidacao(chamar, sistema, usuario, 0.4, secao.titulo);
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

  const { html } = await escreverComValidacao(chamar, regrasGerais(ctx), usuario, 0.4, secao.titulo);
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
