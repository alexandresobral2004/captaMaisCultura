/**
 * Exporta os filtros de TI do banco (tabela configuracoes) para data/filtros/*.json.
 * Assim as alterações feitas pelas telas aparecem no `git diff` e podem ser revisadas e revertidas.
 *
 * Uso (precisa de DATABASE_URL):
 *   npx tsx scripts/exportar-filtros.ts
 *
 * Não altera o banco. Só escreve os arquivos locais; commite se quiser versionar o estado atual.
 */
import fs from 'fs';
import path from 'path';
import { lerConfiguracao } from '../lib/config/configuracoes';

const PASTA = path.join(process.cwd(), 'data', 'filtros');
const ARQUIVOS: Record<string, string> = {
  whitelist: 'whitelist-ti.json',
  blacklist: 'blacklist-ti.json',
  categorias: 'categorias-ti.json',
};

async function main() {
  fs.mkdirSync(PASTA, { recursive: true });
  for (const [nome, arquivo] of Object.entries(ARQUIVOS)) {
    const valor = await lerConfiguracao<unknown>(`filtros.${nome}`);
    if (valor === null) {
      console.log(`- ${nome}: não existe no banco (arquivo mantido)`);
      continue;
    }
    fs.writeFileSync(path.join(PASTA, arquivo), JSON.stringify(valor, null, 2) + '\n', 'utf-8');
    console.log(`✅ ${nome} → data/filtros/${arquivo}`);
  }
}

main().catch((erro) => {
  console.error('Falha ao exportar filtros:', erro);
  process.exit(1);
});
