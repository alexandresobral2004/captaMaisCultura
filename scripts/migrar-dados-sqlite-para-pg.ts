/**
 * Copia os dados do SQLite (data/db/editais.db) para o Postgres de DATABASE_URL.
 *
 * Uso:
 *   DATABASE_URL=postgres://... npx tsx scripts/migrar-dados-sqlite-para-pg.ts [opções]
 *
 * Opções:
 *   --sqlite=<caminho>  arquivo SQLite de origem (padrão: data/db/editais.db)
 *   --simular           faz tudo dentro de uma transação e desfaz no fim: valida constraints sem gravar
 *   --limpar            esvazia as tabelas do Postgres antes de copiar (sem isso, aborta se houver dados)
 *
 * Pré-requisito: tabelas criadas com `npm run db:migrate`.
 *
 * O que faz:
 * - copia as tabelas do schema.ts na ordem das chaves estrangeiras (pais antes dos filhos)
 * - copia só as colunas que existem nos dois bancos, mantendo os ids
 * - converte 0/1 → boolean, remove \u0000 dos textos (o Postgres recusa) e aplica o default
 *   da coluna quando o SQLite tem NULL numa coluna NOT NULL
 * - descarta linhas órfãs (chave estrangeira apontando para pai inexistente) e lista quantas
 * - ajusta as sequências dos ids seriais e confere as contagens no fim
 * Tudo numa transação: se algo falhar, o Postgres fica como estava.
 */
import path from 'path';
import Database from 'better-sqlite3';
import postgres from 'postgres';
import { is, SQL } from 'drizzle-orm';
import { PgTable, getTableConfig } from 'drizzle-orm/pg-core';
import * as schema from '../lib/database/schema';

const LOTE = 200;

const args = process.argv.slice(2);
const SIMULAR = args.includes('--simular');
const LIMPAR = args.includes('--limpar');
const SQLITE_PATH =
  args.find((a) => a.startsWith('--sqlite='))?.slice('--sqlite='.length) ??
  path.join(process.cwd(), 'data', 'db', 'editais.db');
const DATABASE_URL = process.env.DATABASE_URL ?? '';

class Simulacao extends Error {}

type Config = ReturnType<typeof getTableConfig>;
type Coluna = Config['columns'][number];

/** Tabelas do schema ordenadas para que todo pai venha antes dos filhos. */
function tabelasEmOrdem(): Config[] {
  const configs = Object.values(schema as Record<string, unknown>)
    .filter((v): v is PgTable => is(v, PgTable))
    .map((t) => getTableConfig(t));
  const porNome = new Map(configs.map((c) => [c.name, c]));
  const ordem: Config[] = [];
  const visitadas = new Set<string>();

  const visitar = (c: Config) => {
    if (visitadas.has(c.name)) return;
    visitadas.add(c.name);
    for (const fk of c.foreignKeys) {
      const pai = getTableConfig(fk.reference().foreignTable).name;
      if (pai !== c.name && porNome.has(pai)) visitar(porNome.get(pai)!);
    }
    ordem.push(c);
  };
  configs.forEach(visitar);
  return ordem;
}

function converter(valor: unknown, col: Coluna): unknown {
  if (valor === null || valor === undefined) {
    // NOT NULL com default: usa o default em vez de deixar o insert falhar
    if (col.notNull && col.default !== undefined && !is(col.default, SQL)) return col.default;
    return null;
  }
  const tipo = col.getSQLType();
  if (tipo === 'boolean') return valor === true || valor === 1 || valor === '1' || valor === 'true';
  if (tipo === 'integer' || tipo === 'serial' || tipo === 'real') {
    const n = Number(valor);
    if (Number.isNaN(n)) throw new Error(`valor não numérico '${valor}' na coluna ${col.name}`);
    return tipo === 'real' ? n : Math.trunc(n);
  }
  const texto = Buffer.isBuffer(valor) ? valor.toString('utf8') : String(valor);
  return texto.includes('\u0000') ? texto.replace(/\u0000/g, '') : texto;
}

async function main() {
  if (!DATABASE_URL.startsWith('postgres')) {
    console.error('❌ DATABASE_URL precisa apontar para o Postgres de destino (postgres://...).');
    process.exit(1);
  }

  const sqlite = new Database(SQLITE_PATH, { readonly: true, fileMustExist: true });
  const isLocalhost = DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1');
  const pg = postgres(DATABASE_URL, { ssl: isLocalhost ? false : 'require', max: 1, onnotice: () => {} });

  const tabelasSqlite = new Set(
    (sqlite.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all() as { name: string }[]).map((r) => r.name)
  );
  const ordem = tabelasEmOrdem();
  const relatorio: { tabela: string; lidas: number; inseridas: number; orfas: number; repetidas: number }[] = [];

  console.log(`📦 Origem: ${SQLITE_PATH}`);
  console.log(`🐘 Destino: ${DATABASE_URL.replace(/\/\/[^@]*@/, '//***@')}${SIMULAR ? '  (SIMULAÇÃO: nada será gravado)' : ''}\n`);

  try {
    const tabelasPg = new Set(
      (await pg`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`).map((r) => r.table_name as string)
    );
    const faltando = ordem.filter((c) => !tabelasPg.has(c.name)).map((c) => c.name);
    if (faltando.length) {
      console.error(`❌ Tabelas ausentes no Postgres: ${faltando.join(', ')}. Rode antes: npm run db:migrate`);
      process.exit(1);
    }

    await pg.begin(async (tx) => {
      if (LIMPAR) {
        await tx.unsafe(`TRUNCATE TABLE ${ordem.map((c) => `"${c.name}"`).join(', ')} RESTART IDENTITY CASCADE`);
      } else {
        for (const c of ordem) {
          const [{ n }] = await tx.unsafe(`SELECT count(*)::int AS n FROM "${c.name}"`);
          if (n > 0) throw new Error(`a tabela ${c.name} já tem ${n} linhas no Postgres. Use --limpar para substituir.`);
        }
      }

      // Valores das colunas referenciadas por FKs, preenchidos conforme cada pai é copiado
      const chaves = new Map<string, Set<unknown>>();
      const referenciadas = new Set<string>();
      for (const c of ordem) {
        for (const fk of c.foreignKeys) {
          const ref = fk.reference();
          const pai = getTableConfig(ref.foreignTable).name;
          ref.foreignColumns.forEach((col) => referenciadas.add(`${pai}.${col.name}`));
        }
      }

      for (const c of ordem) {
        if (!tabelasSqlite.has(c.name)) {
          console.log(`   ${c.name.padEnd(28)} (não existe no SQLite, pulada)`);
          continue;
        }
        const colunasSqlite = new Set(
          (sqlite.prepare(`PRAGMA table_info("${c.name}")`).all() as { name: string }[]).map((r) => r.name)
        );
        const colunas = c.columns.filter((col) => colunasSqlite.has(col.name));
        const fks = c.foreignKeys.map((fk) => {
          const ref = fk.reference();
          return {
            coluna: ref.columns[0].name,
            alvo: `${getTableConfig(ref.foreignTable).name}.${ref.foreignColumns[0].name}`,
          };
        });

        const linhas = sqlite.prepare(`SELECT * FROM "${c.name}"`).all() as Record<string, unknown>[];
        const validas: Record<string, unknown>[] = [];
        let orfas = 0;
        for (const linha of linhas) {
          const convertida: Record<string, unknown> = {};
          for (const col of colunas) {
            try {
              convertida[col.name] = converter(linha[col.name], col);
            } catch (e) {
              throw new Error(`${c.name}: ${(e as Error).message}`);
            }
          }
          const orfa = fks.some((fk) => {
            const v = convertida[fk.coluna];
            return v !== null && !chaves.get(fk.alvo)?.has(v);
          });
          if (orfa) orfas++;
          else validas.push(convertida);
        }

        let inseridas = 0;
        const nomes = colunas.map((col) => col.name);
        for (let i = 0; i < validas.length; i += LOTE) {
          const lote = validas.slice(i, i + LOTE);
          // Os tipos do TransactionSql do postgres-js não aceitam o helper de lote; em runtime funciona
          const t = tx as any;
          const r = await t`INSERT INTO ${t(c.name)} ${t(lote as any[], ...nomes)} ON CONFLICT DO NOTHING`;
          inseridas += r.count;
        }

        // Guarda as chaves que os filhos vão referenciar (só das linhas que entraram de fato)
        for (const col of colunas) {
          const chave = `${c.name}.${col.name}`;
          if (!referenciadas.has(chave)) continue;
          const presentes = await tx.unsafe(`SELECT "${col.name}" AS v FROM "${c.name}"`);
          chaves.set(chave, new Set(presentes.map((r) => r.v)));
        }

        // Ids seriais copiados explicitamente: a sequência precisa continuar depois do maior
        for (const col of colunas.filter((col) => col.getSQLType() === 'serial')) {
          await tx.unsafe(
            `SELECT setval(pg_get_serial_sequence('"${c.name}"', '${col.name}'), COALESCE(MAX("${col.name}"), 1), MAX("${col.name}") IS NOT NULL) FROM "${c.name}"`
          );
        }

        const repetidas = validas.length - inseridas;
        relatorio.push({ tabela: c.name, lidas: linhas.length, inseridas, orfas, repetidas });
        const avisos = [orfas && `${orfas} órfãs descartadas`, repetidas && `${repetidas} repetidas ignoradas`].filter(Boolean);
        console.log(`   ${c.name.padEnd(28)} ${String(inseridas).padStart(6)} de ${linhas.length}${avisos.length ? `  ⚠️  ${avisos.join(', ')}` : ''}`);
      }

      // Conferência final dentro da mesma transação
      for (const r of relatorio) {
        const [{ n }] = await tx.unsafe(`SELECT count(*)::int AS n FROM "${r.tabela}"`);
        if (n !== r.inseridas) throw new Error(`conferência falhou em ${r.tabela}: esperado ${r.inseridas}, há ${n}`);
      }

      if (SIMULAR) throw new Simulacao();
    });

    const ignoradas = Array.from(tabelasSqlite).filter(
      (t) => !ordem.some((c) => c.name === t) && !t.startsWith('sqlite_') && !t.includes('_fts')
    );
    if (ignoradas.length) console.log(`\nℹ️  Tabelas do SQLite fora do schema (não copiadas): ${ignoradas.join(', ')}`);
    const total = relatorio.reduce((s, r) => s + r.inseridas, 0);
    console.log(`\n✅ ${total} linhas copiadas em ${relatorio.length} tabelas.`);
  } catch (erro) {
    if (erro instanceof Simulacao) {
      const total = relatorio.reduce((s, r) => s + r.inseridas, 0);
      console.log(`\n🧪 Simulação ok: ${total} linhas seriam copiadas. Nada foi gravado (rollback).`);
    } else {
      console.error(`\n❌ Migração abortada, nada foi gravado: ${(erro as Error).message}`);
      process.exitCode = 1;
    }
  } finally {
    sqlite.close();
    await pg.end();
  }
}

main();
