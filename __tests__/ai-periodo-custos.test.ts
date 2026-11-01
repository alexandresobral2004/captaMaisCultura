import { describe, it, expect } from 'vitest';
import { mensagemPeriodoInvalido } from '../lib/ai/periodo-custos';

describe('mensagemPeriodoInvalido', () => {
  it('recusa data inicial depois da data final', () => {
    expect(mensagemPeriodoInvalido('2026-10-02', '2026-10-01')).toBe('A data inicial não pode ser depois da data final.');
  });

  it('aceita o mesmo dia e um intervalo na ordem certa', () => {
    expect(mensagemPeriodoInvalido('2026-10-01', '2026-10-01')).toBeNull();
    expect(mensagemPeriodoInvalido('2026-10-01', '2026-10-31')).toBeNull();
  });

  it('não julga datas vazias: o campo required do navegador cuida disso', () => {
    expect(mensagemPeriodoInvalido('', '2026-10-31')).toBeNull();
  });
});
