import * as cheerio from 'cheerio';
import axios from 'axios';

export interface ResultadoExtracao {
  url: string | null;
  metodo: 'meta_tags' | 'link_direto' | 'html_parse' | 'ia_sugestao' | 'nao_encontrado';
  confianca: number; // 0-100
  motivo: string;
}

/**
 * Extrai a URL do PDF de um edital usando múltiplas estratégias
 * Ordem de prioridade: Meta tags → Links diretos → Parse HTML → Cheerio (último recurso)
 */
export async function extrairUrlPDF(
  html: string,
  url: string,
  metadata?: { titulo?: string; descricao?: string }
): Promise<ResultadoExtracao> {
  // Estratégia 1: Meta tags
  const urlMetaTags = extrairDasMetaTags(html);
  if (urlMetaTags) {
    return {
      url: urlMetaTags,
      metodo: 'meta_tags',
      confianca: 99,
      motivo: 'URL encontrada em meta tags OG'
    };
  }

  // Estratégia 2: Links diretos com terminação .pdf
  const urlLinkDireto = extrairDosLinksDiretos(html, url);
  if (urlLinkDireto) {
    return {
      url: urlLinkDireto,
      metodo: 'link_direto',
      confianca: 95,
      motivo: 'URL de PDF encontrada em link direto'
    };
  }

  // Estratégia 3: Parse estruturado de botões/links
  const urlHtmlParse = extrairDoHTMLParse(html, url);
  if (urlHtmlParse) {
    return {
      url: urlHtmlParse,
      metodo: 'html_parse',
      confianca: 85,
      motivo: 'URL extraída de botão/link com contexto'
    };
  }

  // Estratégia 4: Busca final com Cheerio (último recurso)
  const urlIA = extrairComIA(html, url, metadata);
  if (urlIA && urlIA.url) {
    return {
      url: urlIA.url,
      metodo: 'ia_sugestao',
      confianca: urlIA.confianca || 70,
      motivo: 'URL encontrada por busca final de links'
    };
  }

  return {
    url: null,
    metodo: 'nao_encontrado',
    confianca: 0,
    motivo: 'Não foi possível extrair URL do PDF'
  };
}

/**
 * Estratégia 1: Procura meta tags (og:attachment, og:document, etc)
 */
function extrairDasMetaTags(html: string): string | null {
  const $ = cheerio.load(html);

  // Procura tags Open Graph
  const metatags = [
    "meta[property='og:attachment']",
    "meta[property='og:document']",
    "meta[property='og:pdf']",
    "meta[property='document']",
    "meta[name='document-url']"
  ];

  for (const selector of metatags) {
    const url = $(selector).attr('content');
    if (url && url.includes('pdf')) {
      return url;
    }
  }

  return null;
}

/**
 * Estratégia 2: Procura links com terminação .pdf
 */
function extrairDosLinksDiretos(html: string, baseUrl: string): string | null {
  const $ = cheerio.load(html);

  // Regex para encontrar qualquer link terminado em .pdf
  const pdfLinks = $('a[href*=".pdf"]').toArray();

  if (pdfLinks.length > 0) {
    let href = $(pdfLinks[0]).attr('href');

    if (!href) return null;

    // Converter URL relativa em absoluta
    if (href.startsWith('/')) {
      const dominio = new URL(baseUrl).origin;
      return dominio + href;
    } else if (!href.startsWith('http')) {
      return new URL(href, baseUrl).href;
    }

    return href;
  }

  return null;
}

/**
 * Estratégia 3: Parse estruturado - procura por botões/links com contexto
 */
function extrairDoHTMLParse(html: string, baseUrl: string): string | null {
  const $ = cheerio.load(html);

  // Procura por elementos com textos comuns de download
  const textosDownload = ['download', 'baixar', 'pdf', 'documento', 'edital', 'arquivo', 'anexo'];

  for (const texto of textosDownload) {
    const elementos = $(`a:contains("${texto}"), button:contains("${texto}")`).toArray();

    for (const elemento of elementos) {
      const $el = $(elemento);
      const href = $el.attr('href') || $el.attr('data-url') || $el.attr('data-href');

      if (href && (href.includes('pdf') || href.includes('download'))) {
        // Converter URL relativa em absoluta
        if (href.startsWith('/')) {
          const dominio = new URL(baseUrl).origin;
          return dominio + href;
        } else if (!href.startsWith('http')) {
          return new URL(href, baseUrl).href;
        }
        return href;
      }
    }
  }

  // Procura por elementos com data attributes
  const dataElements = $('[data-pdf], [data-document], [data-download-url]').toArray();
  for (const el of dataElements) {
    const $el = $(el);
    const url = $el.attr('data-pdf') || $el.attr('data-document') || $el.attr('data-download-url');
    if (url) {
      if (url.startsWith('/')) {
        const dominio = new URL(baseUrl).origin;
        return dominio + url;
      } else if (!url.startsWith('http')) {
        return new URL(url, baseUrl).href;
      }
      return url;
    }
  }

  return null;
}

/**
 * Estratégia 4: Busca final por links de PDF usando Cheerio
 * Último recurso quando outras estratégias falham
 */
function extrairComIA(
  html: string,
  url: string,
  metadata?: { titulo?: string; descricao?: string }
): { url: string | null; confianca?: number } | null {
  const $ = cheerio.load(html);

  // Passo 1: Buscar <a> onde href termina em .pdf
  const links = $('a').toArray();
  for (const link of links) {
    const href = $(link).attr('href');
    if (href && href.toLowerCase().endsWith('.pdf')) {
      const urlResolvida = resolverHref(href, url);
      return { url: urlResolvida, confianca: 80 };
    }
  }

  // Passo 2 (fallback): Buscar <a> cujo texto contém palavras-chave
  const palavrasChave = ['baixar', 'edital', 'anexo', 'documento'];
  for (const link of links) {
    const textoAncora = $(link).text().toLowerCase();
    const href = $(link).attr('href');
    if (href && palavrasChave.some(p => textoAncora.includes(p))) {
      const urlResolvida = resolverHref(href, url);
      return { url: urlResolvida, confianca: 60 };
    }
  }

  return null;
}

/**
 * Resolve URL relativa/absoluta para URL completa
 */
function resolverHref(href: string, baseUrl: string): string {
  if (href.startsWith('/')) {
    return new URL(href, baseUrl).origin + href;
  }
  if (!href.startsWith('http')) {
    return new URL(href, baseUrl).href;
  }
  return href;
}

/**
 * Valida se uma URL é acessível e aponta para um PDF válido
 */
export async function validarURLPDF(url: string, timeout = 5000): Promise<boolean> {
  try {
    const response = await axios.head(url, {
      timeout,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EditialBot/1.0)'
      }
    });

    // Verificar se é PDF
    const contentType = String(response.headers['content-type'] || '');
    return response.status === 200 && (contentType.includes('pdf') || contentType.includes('application/octet-stream'));
  } catch (erro) {
    console.warn(`⚠️ URL inválida ou inacessível: ${url}`);
    return false;
  }
}

/**
 * Resolve URLs que podem ter sido redirecionadas ou encurtadas
 */
export async function resolverURLPDF(url: string): Promise<string | null> {
  try {
    const response = await axios.get(url, {
      timeout: 5000,
      maxRedirects: 10,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EditialBot/1.0)'
      },
      validateStatus: () => true // Aceitar todos os status codes
    });

    // Retornar a URL final após redirecionamentos
    return response.request.res.responseUrl || response.config.url || url;
  } catch (erro) {
    console.warn(`⚠️ Erro ao resolver URL: ${url}`);
    return url;
  }
}
