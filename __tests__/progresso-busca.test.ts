import { describe, it, expect } from 'vitest';
import { comecarColeta, comecarProcessamento, registrarItem, terminarBusca, lerProgresso, resultadoDoItem } from '../lib/scraper/progresso-busca';

describe('progresso da busca', () => {
  it('indeterminado na coleta e percentual no processamento', () => {
    comecarColeta();
    expect(lerProgresso()).toMatchObject({ etapa: 'coletando', percentual: null });
    comecarProcessamento(4);
    registrarItem('edital_util', 'A');
    registrarItem('edital_revisar', 'B');
    registrarItem('descartado', 'C');
    registrarItem('ja_existia', 'D');
    const p = lerProgresso();
    expect(p).toMatchObject({ verificados: 4, saoEditais: 2, uteis: 1, paraRevisar: 1, descartados: 1, jaExistentes: 1 });
    expect(p.percentual).toBe(99); // só chega a 100 quando a busca termina
    terminarBusca();
    expect(lerProgresso()).toMatchObject({ etapa: 'concluida', percentual: 100 });
  });

  it('classifica o item pelo status e pela nota', () => {
    expect(resultadoDoItem('descartado', 90)).toBe('descartado');
    expect(resultadoDoItem('duvida', 90)).toBe('edital_revisar');
    expect(resultadoDoItem('pendente', 75)).toBe('edital_util');
    expect(resultadoDoItem('pendente', 40)).toBe('edital');
    expect(resultadoDoItem('sem_pdf', 90)).toBe('edital');
  });
});
