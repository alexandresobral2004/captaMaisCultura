/**
 * Marca como descartados os editais que, na verdade, são itens de menu ou páginas
 * institucionais de portais (Governança, Dados Abertos, Servidores…), gravados antes do
 * filtro de título existir.
 *
 * Uso:
 *   npx tsx scripts/limpar-menus.ts            # só lista o que seria descartado (padrão)
 *   npx tsx scripts/limpar-menus.ts --aplicar  # faz backup do banco e aplica
 *
 * Não apaga nada: muda status_analise para 'descartado' e fora_do_escopo para 1, com o
 * motivo registrado. Editais já analisados ou já descartados ficam de fora.
 */
import Database from 'better-sqlite3';
import { join } from 'path';
import { tituloInstitucional } from '../lib/scraper/validacao-documento';

const MOTIVO = 'Item de menu ou página institucional do portal (limpeza)';
const aplicar = process.argv.includes('--aplicar');

const caminho = join(process.cwd(), 'data', 'db', 'editais.db');
const db = new Database(caminho);

interface Linha {
  id: string;
  titulo: string;
  link: string | null;
  status_analise: string | null;
}

const todos = db
  .prepare(`SELECT id, titulo, link, status_analise FROM editais`)
  .all() as Linha[];

const menus = todos.filter(e => tituloInstitucional(e.titulo, e.link ?? ''));
const protegidos = menus.filter(e => e.status_analise === 'analisado');
const jaDescartados = menus.filter(e => e.status_analise === 'descartado');
const alvos = menus.filter(e => e.status_analise !== 'analisado' && e.status_analise !== 'descartado');

console.log(`Editais no banco: ${todos.length}`);
console.log(`Parecem menu: ${menus.length} (a descartar: ${alvos.length}, já descartados: ${jaDescartados.length}, analisados e mantidos: ${protegidos.length})\n`);

for (const e of alvos) console.log(`  [${e.status_analise ?? 'sem status'}] ${e.titulo.slice(0, 90)}`);
if (protegidos.length > 0) {
  console.log('\nAnalisados (não mexo, confira à mão):');
  for (const e of protegidos) console.log(`  ${e.titulo.slice(0, 90)}`);
}

async function main(): Promise<void> {
  if (!aplicar) {
    console.log('\nNada foi alterado. Rode com --aplicar para descartar os itens acima.');
    return;
  }
  if (alvos.length === 0) {
    console.log('\nNada a fazer.');
    return;
  }

  const carimbo = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backup = `${caminho}.bak-${carimbo}`;
  await db.backup(backup);
  console.log(`\nBackup salvo em ${backup}`);

  const atualizar = db.prepare(
    `UPDATE editais SET status_analise = 'descartado', fora_do_escopo = 1, motivo_rejeicao = ?, atualizado_em = ? WHERE id = ?`
  );
  const agora = new Date().toISOString();
  const aplicarTodos = db.transaction((ids: string[]) => {
    for (const id of ids) atualizar.run(MOTIVO, agora, id);
  });
  aplicarTodos(alvos.map(e => e.id));
  console.log(`${alvos.length} editais descartados. Para desfazer, restaure o backup acima.`);
}

main().catch(erro => {
  console.error(erro);
  process.exit(1);
});
