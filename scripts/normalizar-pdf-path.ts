/**
 * Passo 3 da migração de PDFs: troca `data/downloads/x.pdf` por `downloads/x.pdf` em editais.pdf_path.
 *
 * Só altera a linha se o arquivo já existe no armazenamento configurado (ARMAZENAMENTO_*).
 * Linhas cujo arquivo falta no bucket ficam como estão e são listadas no relatório.
 *
 * Uso (precisa de DATABASE_URL de produção e das variáveis ARMAZENAMENTO_* do passo 1):
 *   npx tsx scripts/normalizar-pdf-path.ts                 # simulação: só mostra o impacto
 *   npx tsx scripts/normalizar-pdf-path.ts --executar      # aplica, numa transação
 *
 * Antes de aplicar, grava um backup dos valores atuais em data/backups/ (use --sem-backup para pular).
 */
import fs from 'fs/promises';
import path from 'path';
import postgres from 'postgres';
import { obterArmazenamento } from '../lib/storage/armazenamento';

const PREFIXO_ANTIGO = 'data/downloads/';
const executar = process.argv.includes('--executar');
const semBackup = process.argv.includes('--sem-backup');

interface Linha {
  id: string;
  pdf_path: string;
}

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.startsWith('postgres')) {
    console.error('❌ DATABASE_URL precisa apontar para o Postgres (postgres://...).');
    process.exit(1);
  }
  if (process.env.ARMAZENAMENTO_DRIVER !== 's3') {
    console.error('❌ ARMAZENAMENTO_DRIVER não é s3. Sem isso, o script confere arquivos no disco local, não no bucket.');
    process.exit(1);
  }

  const isLocalhost = url.includes('localhost') || url.includes('127.0.0.1');
  const sql = postgres(url, { ssl: isLocalhost ? false : 'require', max: 1 });
  const armazenamento = obterArmazenamento();

  try {
    const linhas = await sql<Linha[]>`
      SELECT id, pdf_path FROM editais WHERE pdf_path LIKE ${PREFIXO_ANTIGO + '%'}
    `;
    console.log(`Driver: s3 | registros com prefixo "data/": ${linhas.length} | ${executar ? 'EXECUTANDO' : 'simulação'}`);

    const prontos: Linha[] = [];
    const faltando: Linha[] = [];
    for (const linha of linhas) {
      const novaChave = linha.pdf_path.slice('data/'.length);
      if (await armazenamento.existe(novaChave)) prontos.push(linha);
      else faltando.push(linha);
    }

    console.log(`Prontos para trocar (arquivo já está no bucket): ${prontos.length}`);
    console.log(`Não serão alterados (arquivo não encontrado no bucket): ${faltando.length}`);
    for (const linha of faltando.slice(0, 20)) {
      console.log(`   - edital ${linha.id}: ${linha.pdf_path}`);
    }
    if (faltando.length > 20) console.log(`   ... e mais ${faltando.length - 20}`);

    if (!executar) {
      console.log('\nNada foi alterado. Rode com --executar para aplicar.');
      return;
    }

    if (!semBackup && prontos.length > 0) {
      const pasta = path.join(process.cwd(), 'data', 'backups');
      await fs.mkdir(pasta, { recursive: true });
      const arquivo = path.join(pasta, `pdf_path-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
      await fs.writeFile(arquivo, JSON.stringify(prontos, null, 2), 'utf-8');
      console.log(`Backup dos valores atuais: ${arquivo}`);
    }

    // Uma transação: ou troca todos os prontos, ou nenhum
    await sql.begin(async (tx) => {
      for (const linha of prontos) {
        await tx`UPDATE editais SET pdf_path = ${linha.pdf_path.slice('data/'.length)} WHERE id = ${linha.id}`;
      }
    });

    const [{ restantes }] = await sql<{ restantes: number }[]>`
      SELECT count(*)::int AS restantes FROM editais WHERE pdf_path LIKE ${PREFIXO_ANTIGO + '%'}
    `;
    console.log(`✅ Trocados: ${prontos.length}. Ainda com prefixo "data/": ${restantes} (esperado: ${faltando.length}).`);
  } finally {
    await sql.end();
  }
}

main().catch((erro) => {
  console.error('Falha na normalização:', erro);
  process.exit(1);
});
