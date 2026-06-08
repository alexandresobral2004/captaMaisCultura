import fs from 'fs';
import path from 'path';
import { EditalUploadService } from '../lib/database/services/edital-upload.service';

// Carregar variáveis de ambiente do env.local manualmente
const envPath = path.join(process.cwd(), 'env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach((line: string) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const parts = trimmed.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      process.env[key] = val;
    }
  });
  console.log('✅ Variáveis de ambiente de env.local carregadas');
  console.log('OPENAI_API_KEY configurada:', !!process.env.OPENAI_API_KEY);
}

const PDF_PATH = path.join(process.cwd(), 'data/downloads/edital-upload-1780634743834-lme5hk.pdf');

async function testar() {
  const service = new EditalUploadService();
  const buffer = fs.readFileSync(PDF_PATH);

  console.log('Iniciando processarUpload para o edital com falha...');
  const result = await service.processarUpload({
    titulo: 'Teste Upload Reanálise Manual',
    orgao: 'Órgão de Teste',
    pdfBuffer: buffer,
    nomeOriginal: 'edital-upload-1780634743834-lme5hk.pdf',
  });

  console.log('\n=========================================');
  console.log('RESULTADO DO PROCESSAMENTO:');
  console.log('=========================================');
  console.log('ID:', result.id);
  console.log('Título:', result.titulo);
  console.log('Texto extraído (caracteres):', result.textoExtraido?.length);
  console.log('Score Adequação:', result.scoreRelevancia);
  console.log('Erros:', result.erros);
}

testar().catch(console.error);
