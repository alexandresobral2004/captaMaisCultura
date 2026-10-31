import type BetterSQLite from 'better-sqlite3';

// Ativa o modo WAL sem depender de sorte. Trocar o journal_mode exige um lock exclusivo, e
// quando vários processos abrem o mesmo arquivo novo ao mesmo tempo (ex.: workers do build do
// Next) a troca pode falhar com "database is locked", mesmo com timeout. Por isso:
// 1) só troca se ainda não estiver em WAL; 2) repete a troca enquanto houver lock.
export function ativarWal(db: BetterSQLite.Database): void {
  const TENTATIVAS = 50;
  for (let tentativa = 0; tentativa < TENTATIVAS; tentativa++) {
    try {
      if (db.pragma('journal_mode', { simple: true }) === 'wal') return;
      db.pragma('journal_mode = WAL');
      return;
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : String(erro);
      if (!/locked|busy/i.test(mensagem)) throw erro;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
  }
  throw new Error('Não foi possível ativar o modo WAL no SQLite após várias tentativas');
}
