import { NextResponse } from 'next/server';
import { getAllEditais, saveEdital } from '@/lib/db/editais-store';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const DOWNLOADS_DIR = path.join(process.cwd(), 'data', 'downloads');

// Extrai informações básicas do nome do arquivo PDF
function extrairInfoDoNome(filename: string) {
  // Exemplos: edital-prosas-17450.pdf, edital-funcap-Iw==.pdf
  const match = filename.match(/edital-([^-]+)-(.+)\.pdf$/);
  
  if (!match) return null;
  
  const source = match[1]; // prosas, funcap, etc
  const id = match[2];
  
  return { source, id, filename };
}

// Verifica se o edital já existe na base
async function editalJaExiste(id: string) {
  const editais = await getAllEditais();
  return editais.some(e => e.id === id);
}

export async function GET() {
  try {
    const files = fs.readdirSync(DOWNLOADS_DIR).filter(f => f.endsWith('.pdf'));
    
    if (files.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'Nenhum PDF encontrado na pasta downloads',
        carregados: 0,
        jaExistentes: 0,
        total: 0
      });
    }

    let carregados = 0;
    let jaExistentes = 0;
    const erros: string[] = [];

    for (const file of files) {
      const info = extrairInfoDoNome(file);
      if (!info) continue;

      // Se o edital já existe, pula
      if (await editalJaExiste(`${info.source}-${info.id}`)) {
        jaExistentes++;
        continue;
      }

      try {
        const filePath = path.join(DOWNLOADS_DIR, file);
        const textoExtraido = extrairTextoDoArquivo(file);
        
        if (textoExtraido) {
          const novoEdital = {
            id: `${info.source}-${info.id}`,
            titulo: `Edital ${file.replace('.pdf', '').replace('edital-', '')}`,
            orgao: info.source.toUpperCase(),
            valor: 'A definir',
            dataLimite: new Date().toISOString().split('T')[0],
            status: 'Aberto' as const,
            descricao: textoExtraido.substring(0, 500), // Primeiros 500 chars
            link: `file://${filePath}`,
            criadoEm: new Date().toISOString(),
            statusAnalise: 'pdf_baixado' as const,
          };
          
          await saveEdital(novoEdital);
          carregados++;
        }
      } catch (error) {
        erros.push(`${file}: ${(error as Error).message}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Editais carregados da pasta downloads',
      carregados,
      jaExistentes,
      total: files.length,
      erros: erros.length > 0 ? erros : undefined
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro ao carregar downloads: ' + (error as Error).message },
      { status: 500 }
    );
  }
}

// Função auxiliar para extrair texto de arquivo -conteudo.txt se existir
function extrairTextoDoArquivo(filename: string): string {
  // Tenta primeiro procurar por um arquivo -conteudo.txt
  const pdfName = filename.replace('.pdf', '');
  const conteudoFile = path.join(DOWNLOADS_DIR, `${pdfName}-conteudo.txt`);
  
  if (fs.existsSync(conteudoFile)) {
    try {
      const conteudo = fs.readFileSync(conteudoFile, 'utf-8');
      return conteudo;
    } catch (error) {
      console.log(`Erro ao ler ${conteudoFile}`);
      return '';
    }
  }
  
  return '';
}
