/**
 * Roda a pontuação em camadas (lib/triagem/pontuacao.ts) sobre os editais do banco e compara com a decisão
 * atual de cada um. Serve para calibrar os limiares de lib/triagem/limiares.ts antes de valer no funil.
 *
 * Uso:
 *   npx tsx scripts/avaliar-pontuacao.ts             # só lê e mostra o relatório (padrão)
 *   npx tsx scripts/avaliar-pontuacao.ts --aplicar   # faz backup do banco e reclassifica
 *
 * Sem consulta ao Jev: vale só a notaRegex, como na triagem sem Jev. Com --aplicar, só mexe em editais que não
 * estão 'analisado' e só no sentido de revisar: 'bloquear' vira descartado e 'cinza' vira dúvida (os que a
 * pontuação libera ficam como estão). Nunca apaga nada.
 */
import Database from 'better-sqlite3';
import { join } from 'path';
import { pontuar, comporNota, descreverPontuacao, type Faixa } from '../lib/triagem/pontuacao';
import { pontuacaoLiberar, pontuacaoBloquear } from '../lib/triagem/limiares';
import type { Eixo } from '../lib/filtros-ti/jev-classifier';

const aplicar = process.argv.includes('--aplicar');
const caminho = join(process.cwd(), 'data', 'db', 'editais.db');
const db = new Database(caminho, { readonly: !aplicar });

interface Linha {
  id: string;
  titulo: string;
  orgao: string | null;
  descricao: string | null;
  status_analise: string | null;
  categoria_area: string | null;
  fora_do_escopo: number | null;
}

const editais = db
  .prepare(`SELECT id, titulo, orgao, descricao, status_analise, categoria_area, fora_do_escopo FROM editais WHERE deleted_at IS NULL`)
  .all() as Linha[];

/** Decisão atual do edital, na mesma escala das faixas da pontuação. */
function faixaAtual(e: Linha): Faixa {
  if (e.status_analise === 'descartado') return 'bloquear';
  if (e.status_analise === 'duvida') return 'cinza';
  return 'liberar';
}

interface Avaliado {
  e: Linha;
  atual: Faixa;
  nova: Faixa;
  texto: string;
  veto: boolean;
  notaRegex: number;
}

function avaliar(e: Linha): Avaliado {
  // Eixo gravado no edital; se não for um dos dois, vale o que pontua melhor
  const eixos: Eixo[] = e.categoria_area === 'Cultura' || e.categoria_area === 'Pesquisa' ? [e.categoria_area] : ['Cultura', 'Pesquisa'];
  const candidatos = eixos.map(eixo => pontuar({ titulo: e.titulo, descricao: e.descricao ?? '', orgao: e.orgao ?? undefined, eixo }));
  const p = candidatos.reduce((a, b) => (b.notaRegex > a.notaRegex ? b : a));
  const nota = comporNota(p.notaRegex, null);
  // Mesma regra da triagem sem Jev: sem termo forte do eixo não há o que pontuar
  const nova: Faixa = p.vetos.length > 0 || p.eixo.fortes === 0 ? 'bloquear' : nota.faixa;
  return { e, atual: faixaAtual(e), nova, texto: descreverPontuacao(p, { ...nota, faixa: nova }), veto: p.vetos.length > 0, notaRegex: p.notaRegex };
}

const avaliados = editais.map(avaliar);
const contar = (f: (a: Avaliado) => boolean) => avaliados.filter(f).length;

console.log(`Editais ativos: ${avaliados.length}  |  cortes: liberar >= ${pontuacaoLiberar()}, bloquear <= ${pontuacaoBloquear()} (só regex, sem Jev)\n`);
console.log('Decisão atual -> pontuação');
for (const atual of ['liberar', 'cinza', 'bloquear'] as Faixa[]) {
  const linha = (['liberar', 'cinza', 'bloquear'] as Faixa[]).map(n => `${n} ${contar(a => a.atual === atual && a.nova === n)}`).join('  ');
  console.log(`  ${atual.padEnd(9)} -> ${linha}`);
}
console.log(`  (atual: liberar = pendente/analisado/sem_pdf; cinza = dúvida; bloquear = descartado)\n`);

const mudam = avaliados.filter(a => a.atual !== a.nova);
console.log(`Mudariam de decisão: ${mudam.length}`);
for (const a of mudam) console.log(`  [${a.atual} -> ${a.nova}${a.veto ? ', veto de região' : ''}] ${a.e.titulo.slice(0, 90)}\n      ${a.texto.slice(0, 300)}`);

const vetados = avaliados.filter(a => a.veto);
console.log(`\nVetos de região: ${vetados.length} (já descartados: ${vetados.filter(a => a.atual === 'bloquear').length})`);
for (const a of vetados.filter(a => a.atual !== 'bloquear')) console.log(`  AINDA ATIVO [${a.e.status_analise}] ${a.e.titulo.slice(0, 90)}`);

async function main(): Promise<void> {
  if (!aplicar) {
    console.log('\nNada foi alterado. Rode com --aplicar para reclassificar.');
    return;
  }
  const alvos = avaliados.filter(a => a.e.status_analise !== 'analisado' && a.e.status_analise !== 'descartado' && a.nova !== 'liberar' && a.nova !== a.atual);
  if (alvos.length === 0) {
    console.log('\nNada a fazer.');
    return;
  }
  const carimbo = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backup = `${caminho}.bak-${carimbo}`;
  await db.backup(backup);
  console.log(`\nBackup salvo em ${backup}`);
  const descartar = db.prepare(`UPDATE editais SET status_analise = 'descartado', fora_do_escopo = 1, motivo_rejeicao = ?, atualizado_em = ? WHERE id = ?`);
  const duvida = db.prepare(`UPDATE editais SET status_analise = 'duvida', motivo_rejeicao = ?, atualizado_em = ? WHERE id = ?`);
  const agora = new Date().toISOString();
  db.transaction(() => {
    for (const a of alvos) (a.nova === 'bloquear' ? descartar : duvida).run(a.texto, agora, a.e.id);
  })();
  console.log(`${alvos.length} editais reclassificados. Para desfazer, restaure o backup acima.`);
}

main().catch(erro => {
  console.error(erro);
  process.exit(1);
});
