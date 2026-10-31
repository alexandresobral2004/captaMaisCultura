import { describe, it, expect } from 'vitest';
import BetterSQLite from 'better-sqlite3';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ativarWal } from '../../lib/database/sqlite-wal';

describe('ativarWal', () => {
  it('deixa o banco em modo WAL', () => {
    const dir = mkdtempSync(join(tmpdir(), 'wal-'));
    const db = new BetterSQLite(join(dir, 'a.db'));
    ativarWal(db);
    expect(db.pragma('journal_mode', { simple: true })).toBe('wal');
    db.close();
  });

  it('pode ser chamada de novo num banco já em WAL, sem erro', () => {
    const dir = mkdtempSync(join(tmpdir(), 'wal-'));
    const db = new BetterSQLite(join(dir, 'b.db'));
    ativarWal(db);
    expect(() => ativarWal(db)).not.toThrow();
    expect(db.pragma('journal_mode', { simple: true })).toBe('wal');
    db.close();
  });
});
