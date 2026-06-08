#!/usr/bin/env ts-node
/**
 * Script para popular a tabela prompts_sistema com os prompts atuais do sistema
 * Executar: npx ts-node scripts/popular-prompts-sistema.ts
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.join(process.cwd(), 'data', 'db', 'editais.db');

if (!fs.existsSync(dbPath)) {
  console.error(`❌ Banco de dados não encontrado em ${dbPath}`);
  process.exit(1);
}

const db = new Database(dbPath);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// Extrair prompts dos arquivos
const promptsProjetoPath = path.join(process.cwd(), 'lib/ai/prompts-projeto.ts');
const promptsPesquisaPath = path.join(process.cwd(), 'lib/analise-cientifica/prompts.ts');

const promptsProjetoContent = fs.readFileSync(promptsProjetoPath, 'utf-8');
const promptsPesquisaContent = fs.readFileSync(promptsPesquisaPath, 'utf-8');

// Função para extrair o corpo de uma função exportada
function extractFunctionBody(content: string, functionName: string): string {
  const regex = new RegExp(`export\\s+(?:async\\s+)?function\\s+${functionName}\\s*\\([^)]*\\)\\s*(?::\\s*Promise<string>)?\\s*\\{([\\s\\S]*?)\\n\\}`, 'm');
  const match = content.match(regex);
  if (match) {
    return match[0]; // Retorna a função completa
  }
  return `[Função ${functionName} não encontrada]`;
}

const prompts = [
  // Projetos de Cultura
  {
    id: 'prompt_cultura_geracao_completa',
    modulo: 'projetos_cultura',
    chave: 'geracao_completa',
    descricao: 'Gera proposta completa de projeto cultural com todas as seções',
    conteudo: extractFunctionBody(promptsProjetoContent, 'gerarPromptCompleto'),
  },
  {
    id: 'prompt_cultura_geracao_secao',
    modulo: 'projetos_cultura',
    chave: 'geracao_secao',
    descricao: 'Gera seções específicas de projeto cultural',
    conteudo: extractFunctionBody(promptsProjetoContent, 'gerarPromptSecao'),
  },
  {
    id: 'prompt_cultura_geracao_dinamica',
    modulo: 'projetos_cultura',
    chave: 'geracao_dinamica',
    descricao: 'Gera proposta com seções dinâmicas customizadas',
    conteudo: extractFunctionBody(promptsProjetoContent, 'gerarPromptDinamico'),
  },
  // Projetos de Pesquisa
  {
    id: 'prompt_pesquisa_geracao_cientifica',
    modulo: 'projetos_pesquisa',
    chave: 'geracao_cientifica',
    descricao: 'Gera proposta completa de projeto científico/acadêmico',
    conteudo: extractFunctionBody(promptsPesquisaContent, 'gerarPromptPropostaCientifica'),
  },
  {
    id: 'prompt_pesquisa_analise_conformidade',
    modulo: 'projetos_pesquisa',
    chave: 'analise_conformidade',
    descricao: 'Analisa conformidade de projeto científico com edital',
    conteudo: extractFunctionBody(promptsPesquisaContent, 'gerarPromptAnaliseConformidade'),
  },
  {
    id: 'prompt_pesquisa_polimento',
    modulo: 'projetos_pesquisa',
    chave: 'polimento',
    descricao: 'Polimenta texto de seção de projeto científico',
    conteudo: extractFunctionBody(promptsPesquisaContent, 'gerarPromptPolimento'),
  },
  {
    id: 'prompt_pesquisa_analise_adequacao',
    modulo: 'projetos_pesquisa',
    chave: 'analise_adequacao',
    descricao: 'Analisa adequação de projeto ao edital',
    conteudo: extractFunctionBody(promptsPesquisaContent, 'gerarPromptAdequacao'),
  },
];

console.log('🚀 Iniciando popularização dos prompts do sistema...\n');

let inseridos = 0;
let atualizados = 0;
let erros = 0;

for (const config of prompts) {
  try {
    console.log(`⏳ Processando: ${config.modulo} - ${config.chave}`);

    const existing = db
      .prepare('SELECT id FROM prompts_sistema WHERE id = ?')
      .get(config.id) as any;

    if (existing) {
      db.prepare(`
        UPDATE prompts_sistema
        SET conteudo_padrao = ?,
            descricao = ?,
            atualizado_em = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(config.conteudo, config.descricao, config.id);

      console.log(`✅ Atualizado: ${config.chave}`);
      atualizados++;
    } else {
      db.prepare(`
        INSERT INTO prompts_sistema (id, modulo, chave, conteudo_padrao, descricao)
        VALUES (?, ?, ?, ?, ?)
      `).run(config.id, config.modulo, config.chave, config.conteudo, config.descricao);

      console.log(`✅ Inserido: ${config.chave}`);
      inseridos++;
    }
  } catch (error: any) {
    console.error(`❌ Erro ao processar ${config.chave}:`, error.message);
    erros++;
  }
}

db.close();

console.log('\n' + '='.repeat(50));
console.log('📊 Resumo:');
console.log(`   ✅ Inseridos: ${inseridos}`);
console.log(`   🔄 Atualizados: ${atualizados}`);
console.log(`   ❌ Erros: ${erros}`);
console.log(`   📝 Total: ${prompts.length}`);
console.log('='.repeat(50));
console.log('\n✅ Popularização concluída!');
