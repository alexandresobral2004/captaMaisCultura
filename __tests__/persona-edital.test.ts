import { describe, it, expect } from 'vitest';
import { ehEditalDePesquisa, personaDoRedator } from '../lib/ai/persona-edital';

describe('persona do redator', () => {
  it('usa perfil de pesquisa para edital de CNPq/IA', () => {
    expect(ehEditalDePesquisa({ titulo: 'Chamada CNPq Universal', orgao: 'CNPq' })).toBe(true);
    expect(personaDoRedator({ titulo: 'Chamada de inteligência artificial' })).toContain('Pesquisador');
  });
  it('mantém produtor cultural para edital de cultura', () => {
    const p = personaDoRedator({ titulo: 'Festival de teatro e dança', orgao: 'Secult-CE' });
    expect(p).toContain('Produtor Cultural');
  });
});
