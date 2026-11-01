import { describe, it, expect } from 'vitest';
import { criarAcumuladorBusca } from '../lib/scraper/progresso-busca';

describe('acumulador de progresso por busca', () => {
  it('duas buscas independentes não misturam contagens', () => {
    const a = criarAcumuladorBusca();
    const b = criarAcumuladorBusca();

    a.comecarColeta();
    a.comecarProcessamento(3);
    a.registrarItem('edital_util', 'A1');

    b.comecarColeta();
    b.comecarProcessamento(5);

    expect(a.ler()).toMatchObject({ etapa: 'processando', total: 3, verificados: 1, uteis: 1 });
    expect(b.ler()).toMatchObject({ etapa: 'processando', total: 5, verificados: 0, uteis: 0 });
  });

  it('uma busca nova começa do zero, mesmo depois de outra ter terminado', () => {
    const primeira = criarAcumuladorBusca();
    primeira.comecarColeta();
    primeira.comecarProcessamento(2);
    primeira.registrarItem('descartado', 'X');
    primeira.terminarBusca();

    const segunda = criarAcumuladorBusca();
    expect(segunda.ler()).toMatchObject({ etapa: 'ociosa', verificados: 0, descartados: 0, total: 0 });

    segunda.comecarColeta();
    expect(segunda.ler()).toMatchObject({ etapa: 'coletando', verificados: 0, descartados: 0 });
  });

  it('ler devolve uma cópia: mexer nela não altera o acumulador', () => {
    const acumulador = criarAcumuladorBusca();
    acumulador.comecarColeta();
    const copia = acumulador.ler();
    copia.etapa = 'erro';
    expect(acumulador.ler().etapa).toBe('coletando');
  });
});
