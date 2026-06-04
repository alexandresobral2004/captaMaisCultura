#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');
const OpenAI = require('openai').default;

const DOWNLOADS_DIR = path.join(process.cwd(), 'data', 'downloads');
const OUTPUT_FILE = path.join(process.cwd(), 'data', 'resumos-editais.json');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Extrai texto do PDF
async function extrairTextoDoPDF(filePath) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const pdfParser = new PDFParse();
    const pdfData = await pdfParser.parseBuffer(fileBuffer);
    return pdfData.text || '';
  } catch (error) {
    throw new Error(`Erro ao ler PDF: ${error.message}`);
  }
}

// Tenta extrair de arquivo -conteudo.txt primeiro
function obterConteudoDisponivel(filePath, filename) {
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
async function resumirComIA(texto, nomeArquivo) {
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
      console.error(`Erro ao fazer parse JSON para ${nomeArquivo}:`, error.message);
    }

    return dadosIA;
  } catch (error) {
    console.error(`❌ Erro ao analisar ${nomeArquivo}:`, error.message);
    return { erroAnalise: error.message };
  }
}

// Extrai ID do nome do arquivo
function extrairID(filename) {
  // edital-prosas-17450.pdf -> prosas-17450
  return filename.replace('edital-', '').replace('.pdf', '');
}

// Extrai título do nome do arquivo
function extrairTitulo(filename) {
  // edital-prosas-17450.pdf -> Edital PROSAS 17450
  const id = extrairID(filename);
  const parts = id.split('-');
  if (parts.length === 2) {
    return `Edital ${parts[0].toUpperCase()} ${parts[1]}`;
  }
  return `Edital ${id}`;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function processarTodos() {
  console.log('🔍 Procurando PDFs em:', DOWNLOADS_DIR);
  
  const files = fs.readdirSync(DOWNLOADS_DIR).filter(f => f.endsWith('.pdf'));
  console.log(`📄 Encontrados ${files.length} PDFs\n`);

  const resumos = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const id = extrairID(file);
    const titulo = extrairTitulo(file);
    
    console.log(`[${i + 1}/${files.length}] 📋 ${file}`);
    
    try {
      const filePath = path.join(DOWNLOADS_DIR, file);
      
      // Tenta primeiro usar conteúdo pré-extraído
      let conteudo = obterConteudoDisponivel(filePath, file);
      
      // Se não encontrou, extrai do PDF
      if (!conteudo) {
        console.log('  ↳ Extraindo texto do PDF...');
        conteudo = await extrairTextoDoPDF(filePath);
      } else {
        console.log('  ↳ Usando arquivo -conteudo.txt');
      }
      
      if (!conteudo || conteudo.trim().length === 0) {
        throw new Error('Nenhum texto foi extraído do PDF');
      }

      console.log('  ↳ Analisando com IA...');
      const analiseIA = await resumirComIA(conteudo, file);

      const resumo = {
        arquivo: file,
        id,
        titulo,
        resumo: analiseIA.resumo || 'Não foi possível gerar resumo',
        objetivo: analiseIA.objetivo,
        requisitos: analiseIA.requisitos || [],
        elegibilidade: analiseIA.elegibilidade,
        itensFinanciáveis: analiseIA.itensFinanciáveis || [],
        documentosNecessarios: analiseIA.documentosNecessarios || [],
        criteriosAvaliacao: analiseIA.criteriosAvaliacao || [],
        dataProcessamento: new Date().toISOString(),
        ...(analiseIA.erroAnalise && { erroAnalise: analiseIA.erroAnalise }),
      };

      resumos.push(resumo);
      console.log(`  ✅ Resumo gerado\n`);

      // Pequeno delay para não sobrecarregar a API
      if (i < files.length - 1) {
        await sleep(2000);
      }
    } catch (error) {
      const errorMsg = error.message;
      console.error(`  ❌ ${errorMsg}\n`);
      
      resumos.push({
        arquivo: file,
        id,
        titulo,
        resumo: 'Erro ao processar',
        dataProcessamento: new Date().toISOString(),
        erroAnalise: errorMsg,
      });
    }
  }

  // Salva os resultados
  console.log('\n💾 Salvando resultados em:', OUTPUT_FILE);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(resumos, null, 2));
  
  console.log(`\n✨ Processamento concluído!`);
  console.log(`   ✅ Processados com sucesso: ${resumos.filter(r => !r.erroAnalise).length}`);
  console.log(`   ❌ Com erros: ${resumos.filter(r => r.erroAnalise).length}`);
  console.log(`   📁 Arquivo salvo: data/resumos-editais.json`);
}

// Executa o script
processarTodos().catch(err => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
