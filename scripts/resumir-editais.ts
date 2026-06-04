#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { saveEdital } from '../lib/db/editais-store';

const DOWNLOADS_DIR = path.join(process.cwd(), 'data', 'downloads');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface EditalResumo {
  arquivo: string;
  id: string;
  titulo: string;
  resumo: string;
  objetivo?: string;
  requisitos?: string[];
  elegibilidade?: string;
  itensFinanciáveis?: string[];
  documentosNecessarios?: string[];
  criteriosAvaliacao?: string[];
  dataProcessamento: string;
  erroAnalise?: string;
}

// Nota: Extraction from PDF is not used, as we prefer -conteudo.txt files
// If you need PDF extraction, implement using pdfjs-dist or another library

// Tenta extrair de arquivo -conteudo.txt primeiro
function obterConteudoDisponivel(filePath: string, filename: string): string | null {
  const pdfName = filename.replace('.pdf', '');
  const conteudoFile = path.join(DOWNLOADS_DIR, `${pdfName}-conteudo.txt`);
  
  if (fs.existsSync(conteudoFile)) {
    try {
      return fs.readFileSync(conteudoFile, 'utf-8');
    } catch (error) {
      console.log(`⚠️  Erro ao ler ${conteudoFile}`);
      return null;
    }
  }
  return null;
}

// Faz resumo usando OpenAI
async function resumirComIA(texto: string, nomeArquivo: string): Promise<Partial<EditalResumo>> {
  try {
    // Limita o texto para evitar tokens excessivos
    const textoLimitado = texto.substring(0, 8000);
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Você é um especialista em análise de editais públicos brasileiros. 
Analise o texto do edital e extraia as informações-chave em formato JSON estruturado.
Seja conciso mas completo. Sempre responda em português.`,
        },
        {
          role: 'user',
          content: `Analise este edital e extraia:
1. resumo: resumo em 2-3 linhas
2. objetivo: qual é o objetivo principal
3. requisitos: array de requisitos principais
4. elegibilidade: critérios de elegibilidade
5. itensFinanciáveis: array de itens que podem ser financiados
6. documentosNecessarios: array de documentos necessários
7. criteriosAvaliacao: array de critérios de avaliação

EDITAL:
${textoLimitado}

Responda APENAS com JSON válido, sem markdown.`,
        },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    const conteudo = response.choices[0].message.content || '{}';
    
    // Tenta fazer parse do JSON
    let dadosIA = {};
    try {
      const jsonMatch = conteudo.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        dadosIA = JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error(`Erro ao fazer parse JSON para ${nomeArquivo}:`, error);
    }

    return dadosIA;
  } catch (error) {
    const errorMsg = (error as Error).message;
    console.error(`❌ Erro ao analisar ${nomeArquivo}:`, errorMsg);
    return { erroAnalise: errorMsg };
  }
}

// Extrai ID do nome do arquivo
function extrairID(filename: string): string {
  // edital-prosas-17450.pdf -> prosas-17450
  return filename.replace('edital-', '').replace('.pdf', '');
}

// Extrai título do nome do arquivo
function extrairTitulo(filename: string): string {
  // edital-prosas-17450.pdf -> Edital PROSAS 17450
  const id = extrairID(filename);
  const parts = id.split('-');
  if (parts.length === 2) {
    return `Edital ${parts[0].toUpperCase()} ${parts[1]}`;
  }
  return `Edital ${id}`;
}

async function processarTodos() {
  console.log('🔍 Procurando PDFs em:', DOWNLOADS_DIR);
  
  const files = fs.readdirSync(DOWNLOADS_DIR).filter(f => f.endsWith('.pdf'));
  console.log(`📄 Encontrados ${files.length} PDFs\n`);

  let processados = 0;
  let erros = 0;
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const id = extrairID(file);
    const titulo = extrairTitulo(file);
    
    console.log(`[${i + 1}/${files.length}] 📋 ${file}`);
    
    try {
      const filePath = path.join(DOWNLOADS_DIR, file);
      
      // Extrai conteúdo pré-extraído
      const conteudo = obterConteudoDisponivel(filePath, file);
      
      if (!conteudo || conteudo.trim().length === 0) {
        throw new Error('Arquivo -conteudo.txt não encontrado ou está vazio');
      }
      
      console.log('  ↳ Usando arquivo -conteudo.txt');

      console.log('  ↳ Analisando com IA...');
      const analiseIA = await resumirComIA(conteudo, file);

      // Salva no banco de dados
      await saveEdital({
        id,
        titulo,
        orgao: id.split('-')[0]?.toUpperCase() || 'DESCONHECIDO',
        valor: 'A definir',
        dataLimite: new Date().toISOString().split('T')[0],
        status: 'Aberto',
        descricao: (analiseIA.resumo as string) || 'Resumo não disponível',
        link: `file://${filePath}`,
        pdfUrl: `file://${filePath}`,
        pdfSalvoEm: path.relative(process.cwd(), filePath),
        criadoEm: new Date().toISOString(),
        analiseIA: {
          resumo: (analiseIA.resumo as string) || 'Não foi possível gerar resumo',
          objetivo: (analiseIA.objetivo as string) || '',
          requisitos: (analiseIA.requisitos as string[]) || [],
          elegibilidade: (analiseIA.elegibilidade as string) || '',
          itensFinanciáveis: (analiseIA.itensFinanciáveis as string[]) || [],
          documentosNecessarios: (analiseIA.documentosNecessarios as string[]) || [],
          criteriosAvaliacao: (analiseIA.criteriosAvaliacao as string[]) || [],
        },
      });

      processados++;
      console.log(`  ✅ Salvo no banco de dados\n`);

      // Pequeno delay para não sobrecarregar a API
      if (i < files.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      const errorMsg = (error as Error).message;
      console.error(`  ❌ ${errorMsg}\n`);
      erros++;
    }
  }
  
  console.log(`\n✨ Processamento concluído!`);
  console.log(`   ✅ Processados com sucesso: ${processados}`);
  console.log(`   ❌ Com erros: ${erros}`);
  console.log(`   📁 Dados salvos no banco de dados SQLite`);
}

// Executa o script
processarTodos().catch(err => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
