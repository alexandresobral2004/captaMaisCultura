import { describe, it, expect } from 'vitest';
import { executarComLimite } from '../../lib/jobs/concorrencia';

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('executarComLimite', () => {
  it('nunca tem mais tarefas em andamento do que o limite', async () => {
    let emAndamento = 0;
    let pico = 0;
    const itens = Array.from({ length: 10 }, (_, i) => i);

    await executarComLimite(itens, 3, async () => {
      emAndamento++;
      pico = Math.max(pico, emAndamento);
      await esperar(5);
      emAndamento--;
    });

    expect(pico).toBe(3);
  });

  it('processa todos os itens quando não há parada', async () => {
    const vistos: number[] = [];
    await executarComLimite([1, 2, 3, 4, 5], 2, async (n) => {
      await esperar(1);
      vistos.push(n);
    });
    expect(vistos.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('para de iniciar tarefas novas quando deveParar vira verdadeiro', async () => {
    const iniciados: number[] = [];
    let parar = false;

    await executarComLimite(
      [1, 2, 3, 4, 5, 6],
      1,
      async (n) => {
        iniciados.push(n);
        if (n === 2) parar = true;
        await esperar(1);
      },
      () => parar,
    );

    expect(iniciados).toEqual([1, 2]);
  });

  it('uma tarefa que falha não derruba as outras', async () => {
    const concluidos: number[] = [];
    await executarComLimite([1, 2, 3], 2, async (n) => {
      if (n === 2) throw new Error('falha isolada');
      concluidos.push(n);
    });
    expect(concluidos.sort()).toEqual([1, 3]);
  });
});
