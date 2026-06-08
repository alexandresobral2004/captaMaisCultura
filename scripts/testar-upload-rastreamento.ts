/**
 * Script de diagnóstico para debug do fluxo de upload de editais
 * 
 * Uso: npx tsx scripts/testar-upload-rastreamento.ts
 */

import path from 'path';
import fs from 'fs';

// Configurar caminho do banco
const DB_PATH = path.join(process.cwd(), 'data', 'capta.db');

console.log('='.repeat(60));
console.log('🔍 DIAGNÓSTICO DO FLUXO DE UPLOAD DE EDITAIS');
console.log('='.repeat(60));

// 1. Verificar se banco existe
console.log('\n1️⃣ Verificando banco de dados...');
console.log(`   Caminho: ${DB_PATH}`);
console.log(`   Existe: ${fs.existsSync(DB_PATH) ? '✅ SIM' : '❌ NÃO'}`);

if (!fs.existsSync(DB_PATH)) {
  console.log('\n❌ Banco de dados não encontrado!');
  console.log('   Execute o setup do banco primeiro.');
  process.exit(1);
}

// 2. Conectar ao banco e verificar estrutura
console.log('\n2️⃣ Conectando ao banco SQLite...');
const { db } = require('../lib/database/db');

try {
  // 3. Verificar editais de upload
  console.log('\n3️⃣ Buscando editais com prefixo "upload-"...');
  const uploads = db.all(`
    SELECT 
      id, 
      titulo, 
      fonte_conteudo, 
      status_analise,
      length(conteudo_completo) as conteudo_len,
      pdf_path,
      criado_em
    FROM editais 
    WHERE id LIKE 'upload-%'
    ORDER BY criado_em DESC
    LIMIT 10
  `);

  if (uploads && uploads.length > 0) {
    console.log(`   ✅ Encontrados ${uploads.length} editais de upload`);
    uploads.forEach((u: any, i: number) => {
      console.log(`\n   [${i + 1}] ${u.id}`);
      console.log(`       - Título: ${u.titulo?.substring(0, 50) || 'N/A'}`);
      console.log(`       - fonte_conteudo: ${u.fonte_conteudo || 'NULL'}`);
      console.log(`       - status_analise: ${u.status_analise || 'NULL'}`);
      console.log(`       - conteudo_completo: ${u.conteudo_len || 0} caracteres`);
      console.log(`       - pdf_path: ${u.pdf_path || 'NULL'}`);
      console.log(`       - criado_em: ${u.criado_em}`);
    });
  } else {
    console.log('   ⚠️ Nenhum edital de upload encontrado');
  }

  // 4. Verificar todos os editais
  console.log('\n4️⃣ Contagem total de editais...');
  const total = db.get(`SELECT COUNT(*) as count FROM editais WHERE deleted_at IS NULL`);
  console.log(`   Total (não deletados): ${total?.count || 0}`);

  const comConteudo = db.get(`
    SELECT COUNT(*) as count 
    FROM editais 
    WHERE conteudo_completo IS NOT NULL 
    AND length(conteudo_completo) > 100
  `);
  console.log(`   Com conteúdo (> 100 chars): ${comConteudo?.count || 0}`);

  const comFonteUpload = db.get(`
    SELECT COUNT(*) as count 
    FROM editais 
    WHERE fonte_conteudo = 'pdf_upload'
  `);
  console.log(`   Com fonte 'pdf_upload': ${comFonteUpload?.count || 0}`);

  // 5. Verificar arquivos PDF
  console.log('\n5️⃣ Verificando arquivos PDF no diretório downloads...');
  const DOWNLOAD_DIR = path.join(process.cwd(), 'data', 'downloads');
  if (fs.existsSync(DOWNLOAD_DIR)) {
    const files = fs.readdirSync(DOWNLOAD_DIR).filter(f => f.endsWith('.pdf'));
    const uploadFiles = files.filter(f => f.startsWith('edital-upload-'));
    console.log(`   Total de PDFs: ${files.length}`);
    console.log(`   PDFs de upload: ${uploadFiles.length}`);
    if (uploadFiles.length > 0) {
      console.log(`   Arquivos: ${uploadFiles.join(', ')}`);
    }
  } else {
    console.log('   ⚠️ Diretório downloads não existe');
  }

  // 6. Verificar estrutura da tabela
  console.log('\n6️⃣ Estrutura da tabela editais...');
  const schema = db.all(`PRAGMA table_info(editais)`);
  const colunasRelevantes = ['id', 'titulo', 'fonte_conteudo', 'status_analise', 'conteudo_completo', 'pdf_path'];
  const colunasExistentes = schema.map((s: any) => s.name);

  colunasRelevantes.forEach(col => {
    const existe = colunasExistentes.includes(col);
    console.log(`   ${existe ? '✅' : '❌'} ${col}`);
  });

} catch (error: any) {
  console.error(`\n❌ Erro ao consultar banco: ${error.message}`);
}

console.log('\n' + '='.repeat(60));
console.log('FIM DO DIAGNÓSTICO');
console.log('='.repeat(60));
