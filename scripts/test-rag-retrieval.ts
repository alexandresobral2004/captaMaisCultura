#!/usr/bin/env tsx
/**
 * Script de Teste do RAG Retrieval
 * Testa a busca de chunks relevantes
 */

import { retrieveChunks, listarCategorias, listarDocumentos } from '../lib/rag/retriever';

async function testRetrieval() {
  console.log('🧪 Teste de Retrieval RAG\n');
  console.log('='.repeat(50));

  // Listar categorias
  console.log('\n📋 Categorias disponíveis:\n');
  const categorias = await listarCategorias();
  categorias.forEach(cat => console.log(`   - ${cat}`));

  // Listar documentos
  console.log('\n📚 Documentos indexados:\n');
  const documentos = await listarDocumentos();
  documentos.forEach(doc => console.log(`   - ${doc}`));

  // Testar buscas
  const queries = [
    { texto: 'orçamento projeto cultural', desc: 'Busca por orçamento' },
    { texto: 'metodologia pesquisa', desc: 'Busca por metodologia' },
    { texto: 'prestação de contas', desc: 'Busca por prestação de contas' },
    { texto: 'Lei Rouanet', desc: 'Busca por Lei Rouanet' },
  ];

  for (const { texto, desc } of queries) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`\n🔍 ${desc}: "${texto}"\n`);

    const resultados = await retrieveChunks({
      texto,
      maxChunks: 3,
    });

    if (resultados.length === 0) {
      console.log('   ⚠️ Nenhum chunk encontrado');
    } else {
      console.log(`   ✅ ${resultados.length} chunks encontrados:\n`);

      for (const chunk of resultados) {
        console.log(`   [Score: ${chunk.score.toFixed(2)}]`);
        console.log(`   📄 ${chunk.metadata.titulo}`);
        console.log(`   📚 ${chunk.metadata.documentoNome}`);
        console.log(`   🏷️ Categoria: ${chunk.metadata.categoria}`);
        console.log(`   📝 Conteúdo: ${chunk.conteudo.slice(0, 200)}...\n`);
      }
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('\n✨ Teste de retrieval concluído!\n');
}

testRetrieval().catch((err) => {
  console.error('❌ Erro no teste:', err);
  process.exit(1);
});
