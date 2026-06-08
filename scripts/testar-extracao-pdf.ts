/**
 * Script para testar pdf-parse v2 - usando a API correta
 */

import fs from 'fs';
import path from 'path';

const PDF_PATH = path.join(process.cwd(), 'data/downloads/edital-upload-1780634743834-lme5hk.pdf');
const buffer = fs.readFileSync(PDF_PATH);

console.log('🔍 Testando pdf-parse v2\n');

async function testar() {
  const { PDFParse } = require('pdf-parse');

  console.log('Criando parser...');
  const parser = new PDFParse({ data: buffer });

  console.log('Extraindo texto...');
  try {
    const result = await parser.getText();
    console.log('Doc:', !!parser.doc);
    console.log('\nTotal:', result.text.length, 'chars');
    if (result.text.length > 0) {
      console.log('Preview:', result.text.substring(0, 500));
    }
  } catch (error) {
    console.error('Erro ao chamar parser.getText():', error);
  }
}

testar().catch(console.error);
