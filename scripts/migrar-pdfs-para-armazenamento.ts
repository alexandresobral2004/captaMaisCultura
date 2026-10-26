/**
 * Envia os PDFs de data/downloads para o armazenamento configurado (ARMAZENAMENTO_DRIVER).
 *
 * Uso:
 *   npx tsx scripts/migrar-pdfs-para-armazenamento.ts            # só lista o que faria
 *   npx tsx scripts/migrar-pdfs-para-armazenamento.ts --executar # envia de fato
 *
 * Idempotente: arquivos já presentes no armazenamento são pulados.
 * Depois de enviar, normalize os caminhos no banco (SQL impresso ao final).
 */
import fs from 'fs/promises';
import path from 'path';
import { obterArmazenamento } from '../lib/storage/armazenamento';

const PASTA_LOCAL = path.join(process.cwd(), 'data', 'downloads');
const executar = process.argv.includes('--executar');

async function main() {
  const armazenamento = obterArmazenamento();
  const nomes = (await fs.readdir(PASTA_LOCAL)).filter((n) => n.endsWith('.pdf'));
  console.log(`Driver: ${process.env.ARMAZENAMENTO_DRIVER || 'local'} | PDFs locais: ${nomes.length} | ${executar ? 'EXECUTANDO' : 'simulação'}`);

  let enviados = 0;
  let pulados = 0;
  for (const nome of nomes) {
    const chave = `downloads/${nome}`;
    if (await armazenamento.existe(chave)) {
      pulados++;
      continue;
    }
    if (executar) {
      await armazenamento.salvar(chave, await fs.readFile(path.join(PASTA_LOCAL, nome)));
    }
    enviados++;
  }

  console.log(`${executar ? 'Enviados' : 'Seriam enviados'}: ${enviados} | já existiam: ${pulados}`);
  console.log(`\nDepois, normalize os caminhos no banco (remove o prefixo "data/"):\n`);
  console.log(`UPDATE editais SET pdf_path = substr(pdf_path, 6) WHERE pdf_path LIKE 'data/downloads/%';`);
}

main().catch((erro) => {
  console.error('Falha na migração:', erro);
  process.exit(1);
});
