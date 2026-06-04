import axios from 'axios';
import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';
import { extrairUrlPDF, validarURLPDF, resolverURLPDF } from './pdf-extractor';
import { extrairTextoLlamaParse } from './llamaparse-extractor';
import { validarConteudoComKeywords } from './keyword-validator';
import { registrarValidacao } from './keyword-logger';
import { logger, LogCenarioFalha, LogAcao } from '../logger';
const pdfParse = require('pdf-parse');

const DOWNLOAD_DIR = path.join(process.cwd(), 'data', 'downloads');

// Interface para opções de download
export interface OpcoesDownload {
  pdfUrlS3?: string;        // URL pré-assinada do S3 (prioridade máxima)
  linkExterno?: string;     // URL do link do edital
  descricaoHtml?: string;   // HTML da descrição da API
}

// Garante que o diretório de downloads exista
function initDownloadDir() {
  if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
  }
}

/**
 * Tenta encontrar um link PDF dentro de uma página HTML usando múltiplas estratégias
 */
async function buscarPdfNaPaginaHtml(urlHtml: string): Promise<string | null> {
  try {
    // Tentar com diferentes headers para evitar bloqueios
    const response = await axios.get(urlHtml, { 
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': 'https://www.google.com/',
        'Cache-Control': 'max-age=0'
      }
    });
    
    // Usar novo extrator com múltiplas estratégias
    const resultado = await extrairUrlPDF(response.data, urlHtml);
    
    if (resultado.url) {
      console.log(`  ✅ PDF encontrado via ${resultado.metodo} (${resultado.confianca}% confiança)`);
      
      // Validar se URL é acessível
      const ehValida = await validarURLPDF(resultado.url);
      if (ehValida) {
        return resultado.url;
      } else {
        // Tentar resolver URL (em caso de redirecionamento)
        const urlResolvida = await resolverURLPDF(resultado.url);
        return urlResolvida;
      }
    }
    
    console.log(`  ℹ️ Nenhum PDF encontrado dentro da página ${urlHtml}`);
    return null;
  } catch (error) {
    console.warn(`⚠️ Erro ao buscar PDF dentro do HTML ${urlHtml}:`, (error as Error).message);
    return null;
  }
}

/**
 * Extrai texto limpo de uma página HTML para usar como fallback.
 */
async function extrairTextoHtml(urlHtml: string): Promise<string | null> {
  try {
    const response = await axios.get(urlHtml, { timeout: 10000 });
    const $ = cheerio.load(response.data);
    
    // Remove scripts, styles, etc
    $('script, style, nav, footer, header, iframe').remove();
    const text = $('body').text().replace(/\s+/g, ' ').trim();
    
    return text || null;
  } catch (error) {
    return null;
  }
}

/**
 * Limpa HTML para texto puro (remove tags, espaços extras)
 */
function limparHtmlParaTexto(html: string): string {
  if (!html) return '';
  
  return html
    .replace(/<[^>]*>/g, ' ')                    // Remove todas as tags HTML
    .replace(/&nbsp;/g, ' ')                     // Converte &nbsp; em espaço
    .replace(/&lt;/g, '<')                       // HTML entities
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')                        // Múltiplos espaços em um
    .trim();
}

/**
 * Baixa um arquivo usando axios e retorna o buffer
 */
async function baixarArquivo(url: string): Promise<Buffer> {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/pdf'
    },
    timeout: 15000
  });
  return Buffer.from(response.data);
}

/**
 * Extrai texto de um buffer PDF.
 * Prioriza LlamaParse (preserva tabelas) com fallback para pdf-parse.
 */
async function extrairTextoPdf(buffer: Buffer): Promise<string> {
  // Estratégia 1: LlamaParse (preserva tabelas e formatação)
  try {
    console.log(`   🦙 Tentando extração via LlamaParse...`);
    const textoLlama = await extrairTextoLlamaParse(buffer);
    if (textoLlama.length > 100) {
      console.log(`   ✅ LlamaParse: ${textoLlama.length} caracteres (Markdown com tabelas)`);
      return textoLlama;
    }
  } catch (erro) {
    console.warn(`   ⚠️ LlamaParse falhou: ${(erro as Error).message}`);
    console.log(`   → Usando pdf-parse como fallback...`);
  }

  // Estratégia 2 (fallback): pdf-parse
  try {
    const PDFParseClass = pdfParse.PDFParse || (pdfParse.default && pdfParse.default.PDFParse) || pdfParse;
    
    if (!PDFParseClass) {
      throw new Error("Classe PDFParse não encontrada no módulo.");
    }

    let text = "";
    
    // Estratégia 2a: Usar pdfParse como função
    try {
      const data = await PDFParseClass(buffer);
      text = data.text || "";
      if (text.length > 100) {
        return text.trim();
      }
    } catch (err1) {
      console.warn(`   ℹ️ Estratégia 2a de extração falhou: ${(err1 as Error).message}`);
    }
    
    // Estratégia 2b: Usar como class
    try {
      const parser = new (PDFParseClass as any)({ data: buffer });
      const data = await parser.getPage(1);
      text = data?.text || "";
      if (text.length > 100) {
        return text.trim();
      }
    } catch (err2) {
      console.warn(`   ℹ️ Estratégia 2b de extração falhou: ${(err2 as Error).message}`);
    }
    
    if (text.length > 0) {
      return text.trim();
    }
    
    throw new Error("Nenhuma estratégia de extração de PDF funcionou");
  } catch (error) {
    console.warn(`   ⚠️ Erro ao extrair texto do PDF: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Valida conteúdo com keywords e registra resultado
 */
async function validarERegistrarConteudo(
  texto: string,
  id: string,
  fonte: string,
  titulo: string,
  filePath: string
): Promise<any> {
  const tempoInicio = Date.now();
  
  try {
    const resultado = await validarConteudoComKeywords(texto);
    const tempoProcessamento = Date.now() - tempoInicio;
    
    // Registrar no log
    registrarValidacao(
      id,
      fonte,
      resultado,
      texto.length,
      tempoProcessamento,
      titulo
    );

    return {
      isEdital: resultado.isEdital,
      scoreTotal: resultado.scoreTotal,
      confianca: resultado.confianca,
      contagem: resultado.contagem,
      densidadeKeywords: resultado.densidadeKeywords,
      motivo: resultado.motivo,
      avisos: resultado.avisos,
      oportunidadesDetectadas: resultado.oportunidadesDetectadas
    };
  } catch (erro) {
    console.error(`❌ Erro ao validar keywords para ${id}:`, erro);
    // Retornar validação padrão se houver erro
    return {
      isEdital: true, // Aceitar por padrão se houver erro
      scoreTotal: 50,
      confianca: 30,
      motivo: 'Erro na validação, aceito automaticamente',
      avisos: ['⚠️ Erro ao validar com keywords - aceitando por padrão']
    };
  }
}

/**
 * Faz o download do PDF, extrai texto e armazena localmente.
 * 
 * FLUXO:
 * 1. Tentar baixar PDF (S3 > Link > HTML)
 * 2. Extrair texto do PDF
 * 3. Armazenar PDF original em data/downloads/
 * 4. Retornar texto extraído para análise
 * 
 * ESTRATÉGIA 1: PDF pré-assinado do S3 (prioridade máxima)
 * ESTRATÉGIA 2: Link externo (pode ser PDF direto ou página web)
 * ESTRATÉGIA 3: Descrição HTML da API (fallback)
 * 
 * @param validarKeywords - Se true, valida conteúdo com keywords antes de persistir
 */
export async function baixarELerPDFEdital(
  id: string,
  opcoes: OpcoesDownload,
  orgao: string,
  titulo: string,
  dataLimite: string,
  validarKeywords: boolean = false
): Promise<{
  texto: string;
  fonte: 'pdf_s3' | 'pdf_link' | 'html_link' | 'descricao_api' | 'sem_pdf';
  pdfUrlEncontrada?: string;
  caminhoArquivo: string;
  tamanhoBytes?: number;
  validacaoKeywords?: any;
}> {
  initDownloadDir();
  const filePath = path.join(DOWNLOAD_DIR, `edital-${id}.pdf`);
  
  console.log(`\n📥 [DOWNLOAD] Iniciando download do edital ${id}...`);
  console.log(`   - PDF S3: ${opcoes.pdfUrlS3 ? '✅' : '❌'}`);
  console.log(`   - Link Externo: ${opcoes.linkExterno ? '✅' : '❌'}`);
  console.log(`   - Descrição HTML: ${opcoes.descricaoHtml ? '✅' : '❌'}`);
  console.log(`   📋 FLUXO: Baixar → Extrair Texto → Armazenar`);

  // ESTRATÉGIA 1: PDF pré-assinado do S3 (PRIORIDADE MÁXIMA)
  if (opcoes.pdfUrlS3) {
    try {
      console.log(`   🔍 Estratégia 1: Baixando PDF do S3...`);
      console.log(`   🔽 ETAPA 1: Fazendo download...`);
      const buffer = await baixarArquivo(opcoes.pdfUrlS3);
      console.log(`   ✅ PDF baixado: ${buffer.length} bytes`);
      
      console.log(`   📄 ETAPA 2: Salvando PDF em: ${filePath}`);
      // ✨ SALVAR PDF ORIGINAL PRIMEIRO
      fs.writeFileSync(filePath, buffer);
      console.log(`   ✅ PDF original armazenado`);
      
      console.log(`   🔤 ETAPA 3: Extraindo texto do PDF...`);
      const texto = await extrairTextoPdf(buffer);
      console.log(`   ✅ Texto extraído: ${texto.length} caracteres`);
      
      // Validar com keywords se habilitado
      let validacaoKeywords = undefined;
      if (validarKeywords) {
        console.log(`   🔍 Validando conteúdo com palavras-chave...`);
        validacaoKeywords = await validarERegistrarConteudo(
          texto,
          id,
          'prosas_s3',
          titulo,
          filePath
        );

        if (!validacaoKeywords.isEdital) {
          console.warn(`   ❌ Conteúdo não passou na validação: ${validacaoKeywords.motivo}`);
          return {
            texto: '',
            fonte: 'sem_pdf',
            caminhoArquivo: filePath,
            validacaoKeywords
          };
        }
        console.log(`   ✅ Validação aprovada: Score ${validacaoKeywords.scoreTotal}%, Confiança ${validacaoKeywords.confianca}%`);
      }
      
      return {
        texto,
        fonte: 'pdf_s3',
        pdfUrlEncontrada: opcoes.pdfUrlS3,
        caminhoArquivo: filePath,
        tamanhoBytes: buffer.length,
        validacaoKeywords
      };
    } catch (error: any) {
      const isTimeout = error.message?.includes('timeout') || error.message?.includes('ETIMEDOUT');
      const isNetwork = !error.response && error.message?.includes('network');

      console.warn(`   ⚠️ Falha na Estratégia 1 (S3): ${error.message}`);

      await logger.logWarning(
        `Falha no download S3: ${error.message}`,
        isTimeout ? 'timeout' : isNetwork ? 'network_error' : 'download_pdf',
        'fallback',
        { url: opcoes.pdfUrlS3, estrategia: 's3' }
      );

      console.log(`   → Tentando próxima estratégia...`);
    }
  }

  // ESTRATÉGIA 2: Link externo
  if (opcoes.linkExterno && opcoes.linkExterno.startsWith('http')) {
    try {
      const linkLimpo = opcoes.linkExterno.trim();
      console.log(`   🔍 Estratégia 2: Tentando link externo: ${linkLimpo}`);
      
        // 2a: Se é PDF direto
        if (linkLimpo.toLowerCase().endsWith('.pdf')) {
          try {
            console.log(`   🔍 Estratégia 2a: Link é PDF direto`);
            console.log(`   🔽 ETAPA 1: Baixando PDF...`);
            const buffer = await baixarArquivo(linkLimpo);
            console.log(`   ✅ PDF baixado: ${buffer.length} bytes`);
            
            console.log(`   📄 ETAPA 2: Salvando PDF em: ${filePath}`);
            // ✨ SALVAR PDF ORIGINAL COMPLETO
            fs.writeFileSync(filePath, buffer);
            console.log(`   ✅ PDF original armazenado`);

            console.log(`   🔤 ETAPA 3: Extraindo texto do PDF...`);
            const texto = await extrairTextoPdf(buffer);
            console.log(`   ✅ Texto extraído: ${texto.length} caracteres`);

            // Validar com keywords se habilitado
            let validacaoKeywords = undefined;
            if (validarKeywords) {
              console.log(`   🔍 Validando conteúdo com palavras-chave...`);
              validacaoKeywords = await validarERegistrarConteudo(
                texto,
                id,
                'link_externo',
                titulo,
                filePath
              );

              if (!validacaoKeywords.isEdital) {
                console.warn(`   ❌ Conteúdo não passou na validação: ${validacaoKeywords.motivo}`);
                return {
                  texto: '',
                  fonte: 'sem_pdf',
                  caminhoArquivo: filePath,
                  validacaoKeywords
                };
              }
              console.log(`   ✅ Validação aprovada: Score ${validacaoKeywords.scoreTotal}%, Confiança ${validacaoKeywords.confianca}%`);
            }
            
             return {
              texto,
              fonte: 'pdf_link',
              pdfUrlEncontrada: linkLimpo,
              caminhoArquivo: filePath,
              tamanhoBytes: buffer.length,
              validacaoKeywords
            };
            } catch (err) {
              console.warn(`   ⚠️ Falha na Estratégia 2a: ${(err as Error).message}`);
              console.log(`   → Tentando próxima estratégia...`);
            }
         } else {
           // 2b: É página web - procurar PDF dentro
           console.log(`   🔍 Estratégia 2b: Link é página web. Procurando PDF...`);
           
           try {
             const pdfDaWeb = await buscarPdfNaPaginaHtml(linkLimpo);
             
             if (pdfDaWeb) {
               try {
                 console.log(`   📥 PDF encontrado na página: ${pdfDaWeb}`);
                 console.log(`   🔽 ETAPA 1: Baixando PDF original...`);
                 const buffer = await baixarArquivo(pdfDaWeb);
                 console.log(`   ✅ PDF baixado: ${buffer.length} bytes`);
                 
                 console.log(`   📄 ETAPA 2: Salvando PDF em: ${filePath}`);
                 // ✨ SALVAR PDF ORIGINAL COMPLETO
                 fs.writeFileSync(filePath, buffer);
                 console.log(`   ✅ PDF original armazenado`);
                 
                 console.log(`   🔤 ETAPA 3: Extraindo texto do PDF...`);
                 const texto = await extrairTextoPdf(buffer);
                 
                 if (texto && texto.length > 100) {
                   console.log(`   ✅ Texto extraído com sucesso: ${texto.length} caracteres`);
                   return {
                     texto,
                     fonte: 'html_link',
                     pdfUrlEncontrada: pdfDaWeb,
                     caminhoArquivo: filePath,
                     tamanhoBytes: buffer.length
                   };
                 } else {
                   console.warn(`   ⚠️ Texto extraído muito pequeno (${texto?.length || 0} chars)`);
                   // Continuar com fallback HTML
                 }
               } catch (pdfErr) {
                 console.warn(`   ⚠️ Erro ao processar PDF: ${(pdfErr as Error).message}`);
                 // Continuar com fallback HTML
               }
             }
             
             // FALLBACK: Se PDF falhou, tentar extrair do HTML da página
             console.log(`   🔄 Fallback: Extraindo texto do HTML da página...`);
             const textoWeb = await extrairTextoHtml(linkLimpo);

             if (textoWeb && textoWeb.length > 200) {
               console.log(`   ✅ Texto extraído do HTML: ${textoWeb.length} caracteres`);
               
               return {
                 texto: textoWeb,
                 fonte: 'html_link',
                 caminhoArquivo: filePath,
                 tamanhoBytes: 0
               };
             }
} catch (err) {
              console.warn(`   ⚠️ Falha ao processar página web: ${(err as Error).message}`);

              await logger.logWarning(
                `Falha ao processar página web: ${(err as Error).message}`,
                'download_pdf',
                'fallback',
                { url: linkLimpo, estrategia: 'html_page' }
              );
            }
         }
      } catch (error: any) {
        console.warn(`   ⚠️ Erro geral na estratégia 2: ${error.message}`);
      }
    }

  // ESTRATÉGIA 3: Descrição HTML da API
  if (opcoes.descricaoHtml) {
    try {
      console.log(`   🔍 Estratégia 3: Usando descrição HTML da API...`);
      const textoDescricao = limparHtmlParaTexto(opcoes.descricaoHtml);
      
      if (textoDescricao.length > 200) {
        console.log(`   ✅ Descrição convertida em texto: ${textoDescricao.length} caracteres`);
        
        // ✨ USAR APENAS O CONTEÚDO, SEM FAKE PDF
        return {
          texto: textoDescricao,
          fonte: 'descricao_api',
          caminhoArquivo: filePath,
          tamanhoBytes: 0
        };
      }
    } catch (error: any) {
      console.warn(`   ⚠️ Erro ao processar descrição: ${error.message}`);
    }
  }

  // Nenhuma estratégia funcionou
  console.log(`   ❌ Nenhuma fonte de conteúdo disponível para o edital ${id}`);
  return {
    texto: '',
    fonte: 'sem_pdf',
    caminhoArquivo: filePath
  };
}
