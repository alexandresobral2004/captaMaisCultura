import axios from 'axios';
import crypto from 'crypto';
import * as cheerio from 'cheerio';
import { Edital, isEditalExcluido, parseDateString } from '../db/editais-store';
import { triarEditalDoPortal, camposTriagemParaEdital } from '../triagem/scraper';
import { pipelineLogger } from './pipeline-logger';
import { PortalConfig, atualizarUltimoScan } from './config';

/** Portais que já têm coletor próprio e não devem passar pelo genérico. */
export const PORTAIS_COM_COLETOR_PROPRIO = ['prosas', 'capta', 'finep', 'cnpq', 'capes', 'mcti'];

const PALAVRAS_EDITAL = /edital|editais|chamada|chamamento|sele[cç][aã]o|bolsa|oportunidade|concurso|pr[eê]mio/i;
const LIXO_NAVEGACAO = /^(editais|chamadas|saiba mais|leia mais|ver mais|clique aqui|voltar|início|home|todos os editais|mais informações)$|compartilhe|copiar para|^anexo|^busca de chamadas|oportunidades (abertas|encerradas)|^(chamadas|editais) (abertas|encerradas|em andamento)/i;

export interface ItemColetado {
  titulo: string;
  link: string;
  dataLimite: string;
}

function extrairDataFutura(texto: string, agora: Date): string | null {
  const datas = Array.from(texto.matchAll(/(\d{1,2})\/(\d{1,2})\/(\d{4})/g)).map(m => m[0]);
  for (const d of datas) {
    const parsed = parseDateString(d);
    if (parsed && parsed >= agora) return d;
  }
  return null;
}

/** Extrai candidatos a edital de uma página de listagem. Função pura, sem rede. */
export function extrairItensDePagina(html: string, urlBase: string, agora = new Date()): ItemColetado[] {
  const $ = cheerio.load(html);
  $('nav, header, footer, script, style').remove();
  const vistos = new Set<string>();
  const itens: ItemColetado[] = [];

  $('a[href]').each((_, el) => {
    const href = ($(el).attr('href') || '').trim();
    const titulo = $(el).text().replace(/\s+/g, ' ').trim();
    if (!href || href.startsWith('#') || /^(mailto|tel|javascript):/i.test(href)) return;
    if (titulo.length < 15 || titulo.length > 300 || LIXO_NAVEGACAO.test(titulo)) return;
    if (!PALAVRAS_EDITAL.test(titulo) && !PALAVRAS_EDITAL.test(href)) return;

    let link: string;
    try {
      link = new URL(href, urlBase).toString();
    } catch {
      return;
    }
    if (vistos.has(link)) return;
    vistos.add(link);

    // Prazo: procura no bloco que contém o link (item de lista, linha ou cartão)
    const bloco = $(el).closest('li, tr, article, .card, div').first().text().replace(/\s+/g, ' ');
    const dataLimite = extrairDataFutura(bloco, agora);
    // Se o bloco só tem datas passadas, o edital está encerrado
    if (!dataLimite && /\d{1,2}\/\d{1,2}\/\d{4}/.test(bloco)) return;

    itens.push({ titulo, link, dataLimite: dataLimite || 'A consultar' });
  });

  return itens;
}

function gerarId(portalId: string, link: string): string {
  return `${portalId}-${crypto.createHash('sha256').update(link).digest('hex').substring(0, 16)}`;
}

/** Coletor genérico: lê a página de listagem do portal e passa cada item pela triagem. */
export async function buscarEditaisPortalGenerico(portal: PortalConfig): Promise<Edital[]> {
  const editais: Edital[] = [];
  const urls = [portal.urlBusca, ...(portal.urlsFallback || [])];
  let html: string | null = null;
  let urlUsada = portal.urlBusca;

  for (const url of urls) {
    try {
      const resp = await axios.get(url, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'pt-BR,pt;q=0.9',
        },
      });
      html = String(resp.data);
      urlUsada = url;
      break;
    } catch {
      continue;
    }
  }

  if (!html) {
    pipelineLogger.logErro(portal.id, `Nenhuma URL acessível para ${portal.nome}`);
    return [];
  }

  const itens = extrairItensDePagina(html, urlUsada).slice(0, 60);
  pipelineLogger.logBusca(`${portal.nome}: ${itens.length} candidatos na página`);
  let rejeitados = 0;

  for (const item of itens) {
    const id = gerarId(portal.id, item.link);
    if (await isEditalExcluido(id, item.link)) continue;

    const triagem = await triarEditalDoPortal(portal.id, { titulo: item.titulo, descricao: '', orgao: portal.nome });
    if (!triagem.aceito) {
      rejeitados++;
      pipelineLogger.logResultado(id, item.titulo, 'rejeitado', `Triagem (${triagem.etapa})`);
      continue;
    }

    editais.push({
      id,
      titulo: item.titulo,
      orgao: portal.nome,
      valor: 'A consultar',
      dataLimite: item.dataLimite,
      status: 'Aberto',
      link: item.link,
      descricao: '',
      criadoEm: new Date().toISOString(),
      ...camposTriagemParaEdital(triagem),
    });
    pipelineLogger.logResultado(id, item.titulo, 'salvo', 'Coletor genérico');
    await new Promise(res => setTimeout(res, 300));
  }

  pipelineLogger.logBusca(`${portal.nome} concluído: ${editais.length} aceitos, ${rejeitados} rejeitados`);
  try { await atualizarUltimoScan(portal.id); } catch { /* não bloqueia a busca */ }
  return editais;
}
