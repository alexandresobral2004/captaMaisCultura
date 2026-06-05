/**
 * RAG - Extrator de Texto de PDFs
 * Extrai texto de PDFs da pasta base/ para indexação RAG
 * 
 * Nota: pdf-parse v2.x usa API baseada em classe com método getText()
 * que retorna { pages, text, total }
 */

import * as fs from 'fs';
import * as path from 'path';

interface PdfExtractorResult {
  texto: string;
  paginas: number;
  metadados: {
    titulo?: string;
    autor?: string;
    data?: string;
  };
}

/**
 * Extrai texto de um PDF usando pdf-parse v2.x
 */
export async function extrairTextoPdf(caminhoPdf: string): Promise<PdfExtractorResult> {
  const buffer = fs.readFileSync(caminhoPdf);

  // Dynamic import para funcionar com ES modules
  const pdfParseModule = await import('pdf-parse');

  // A nova versão (2.x) exporta PDFParse como classe
  const PDFParse = pdfParseModule.PDFParse;

  if (!PDFParse) {
    throw new Error("PDFParse não encontrado no módulo pdf-parse");
  }

  try {
    // Criar instância do parser
    const parser = new PDFParse({ data: buffer });

    // Extrair texto completo usando getText()
    // Retorna { pages, text, total }
    const result = await (parser as any).getText();
    const texto = result.text || '';

    // Obter info do PDF
    const info = await (parser as any).getInfo();

    return {
      texto: texto.trim(),
      paginas: (info as any)?.numPages || result.total || 1,
      metadados: {
        titulo: (info as any)?.title || path.basename(caminhoPdf, '.pdf'),
        autor: (info as any)?.author,
        data: (info as any)?.creationDate,
      },
    };
  } catch (error) {
    throw new Error(`Erro ao extrair texto do PDF ${caminhoPdf}: ${(error as Error).message}`);
  }
}

/**
 * Lista todos os PDFs na pasta base/
 */
export function listarPdfs(basePath: string = 'base'): string[] {
  const pdfs: string[] = [];

  if (!fs.existsSync(basePath)) {
    console.warn(`⚠️ Pasta base/ não encontrada: ${basePath}`);
    return pdfs;
  }

  const arquivos = fs.readdirSync(basePath);

  for (const arquivo of arquivos) {
    if (arquivo.toLowerCase().endsWith('.pdf')) {
      pdfs.push(path.join(basePath, arquivo));
    }
  }

  return pdfs;
}

/**
 * Detecta o tipo do documento baseado no nome do arquivo
 */
export function detectarTipoDocumento(nomeArquivo: string): 'manual' | 'modelo' | 'dicas' | 'tecnico' | 'legislacao' {
  const nome = nomeArquivo.toLowerCase();

  if (nome.includes('manual') || nome.includes('guia')) {
    return 'manual';
  }
  if (nome.includes('modelo')) {
    return 'modelo';
  }
  if (nome.includes('dica')) {
    return 'dicas';
  }
  if (nome.includes('lei') || nome.includes('legislacao') || nome.includes('portaria')) {
    return 'legislacao';
  }

  return 'tecnico';
}
