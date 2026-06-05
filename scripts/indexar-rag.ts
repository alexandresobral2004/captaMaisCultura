#!/usr/bin/env tsx
/**
 * Script de Indexação RAG
 *
 * Extrai texto dos PDFs na pasta base/, divide em chunks e indexa no SQLite.
 *
 * Uso: npx tsx scripts/indexar-rag.ts
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { runRagMigration } from '../lib/rag/migration';
import { indexarBaseConhecimento, verificarIndexacao } from '../lib/rag/indexer';
import { listarCategorias, listarDocumentos } from '../lib/rag/retriever';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const baseDir = path.join(__dirname, '..', 'base');

async function main() {
  console.log('🚀 Script de Indexação RAG\n');
  console.log('='.repeat(50));

  // Executar migration FTS5
  console.log('\n🔧 Executando migration FTS5...\n');
  try {
    await runRagMigration();
    console.log('✅ Migration FTS5 executada com sucesso!');
  } catch (error) {
    console.warn('⚠️ Migration FTS5 pode já existir:', (error as Error).message);
  }

  // Verificar indexação atual
  console.log('\n📊 Verificando indexação atual...\n');
  const atual = await verificarIndexacao();

  if (atual.totalChunks > 0) {
    console.log(`   Chunks existentes: ${atual.totalChunks}`);
    console.log(`   Documentos: ${atual.documentos.length}`);
    atual.documentos.forEach(doc => console.log(`      - ${doc}`));
  } else {
    console.log('   Nenhuma indexação encontrada.');
  }

  // Executar indexação
  console.log('\n' + '='.repeat(50));
  console.log('\n📚 Iniciando indexação...\n');

  const stats = await indexarBaseConhecimento(baseDir);

  // Resumo final
  console.log('\n' + '='.repeat(50));
  console.log('\n✅ Indexação concluída!\n');

  // Listar categorias disponíveis
  console.log('\n📋 Categorias disponíveis:\n');
  const categorias = await listarCategorias();
  categorias.forEach(cat => console.log(`   - ${cat}`));

  // Listar documentos
  console.log('\n📚 Documentos indexados:\n');
  const documentos = await listarDocumentos();
  documentos.forEach(doc => console.log(`   - ${doc}`));

  console.log('\n' + '='.repeat(50));
  console.log('\n✨ RAG pronto para uso!\n');
}

main().catch((err) => {
  console.error('❌ Erro na indexação:', err);
  process.exit(1);
});
