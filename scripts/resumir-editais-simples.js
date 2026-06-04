#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const OpenAI = require('openai').default;

const DOWNLOADS_DIR = path.join(process.cwd(), 'data', 'downloads');
const OUTPUT_FILE = path.join(process.cwd(), 'data', 'resumos-editais.json');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
  return filename.replace('edital-', '').replace('-conteudo.txt', '').replace('.pdf', '');
}

// Extrai título do nome do arquivo
function extrairTitulo(filename) {
  // edital-prosas-17450-conteudo.txt -> Edital PROSAS 17450
  const id = extrairID(filename);
  const parts = id.split('-');
  if (parts.length >= 2) {
    return `Edital ${parts[0].toUpperCase()} ${parts.slice(1).join('-')}`;
  }
  return `Edital ${id}`;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function processarTodos() {
  console.log('🔍 Procurando arquivos -conteudo.txt em:', DOWNLOADS_DIR);
  
  const files = fs.readdirSync(DOWNLOADS_DIR)
    .filter(f => f.endsWith('-conteudo.txt'))
    .sort();
  
  console.log(`📄 Encontrados ${files.length} arquivos\n`);

  if (files.length === 0) {
    console.log('⚠️  Nenhum arquivo -conteudo.txt encontrado na pasta downloads');
    console.log('💡 Dica: Execute a busca inteligente ou copie os PDFs para a pasta downloads');
    process.exit(0);
  }

  const resumos = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const id = extrairID(file);
    const titulo = extrairTitulo(file);
    
    console.log(`[${i + 1}/${files.length}] 📋 ${file}`);
    
    try {
      const filePath = path.join(DOWNLOADS_DIR, file);
      const conteudo = fs.readFileSync(filePath, 'utf-8');
      
      if (!conteudo || conteudo.trim().length === 0) {
        throw new Error('Arquivo está vazio');
      }

      console.log('  ↳ Analisando com IA...');
      const analiseIA = await resumirComIA(conteudo, file);

      const resumo = {
        arquivo: file.replace('-conteudo.txt', '.pdf'),
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
        await sleep(1500);
      }
    } catch (error) {
      const errorMsg = error.message;
      console.error(`  ❌ ${errorMsg}\n`);
      
      resumos.push({
        arquivo: file.replace('-conteudo.txt', '.pdf'),
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
