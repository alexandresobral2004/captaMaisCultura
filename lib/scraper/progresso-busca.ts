import { SCORE_MEDIO } from '../triagem/limiares';

/**
 * Andamento da busca por novos editais. Cada busca tem o seu acumulador (criarAcumuladorBusca);
 * quem lê o andamento de fora (tela, outra réplica) lê o snapshot gravado no job, não a memória.
 */
export type EtapaBusca = 'ociosa' | 'coletando' | 'processando' | 'concluida' | 'erro';

export interface ProgressoBusca {
  etapa: EtapaBusca;
  /** Itens encontrados nos portais que serão verificados. */
  total: number;
  /** Itens já verificados (novos, descartados ou que já existiam). */
  verificados: number;
  /** Itens novos que são edital de verdade (passaram pela triagem e pela leitura do documento). */
  saoEditais: number;
  /** Editais novos úteis: nota alta ou média e prontos para análise. */
  uteis: number;
  /** Editais novos em dúvida, para uma pessoa revisar. */
  paraRevisar: number;
  /** Itens que não eram edital. */
  descartados: number;
  /** Já estavam no sistema e não foram baixados de novo. */
  jaExistentes: number;
  atual: string | null;
  /** 0 a 100; null enquanto ainda não se sabe o total. */
  percentual: number | null;
  atualizadoEm: string;
}

const vazio = (): ProgressoBusca => ({
  etapa: 'ociosa', total: 0, verificados: 0, saoEditais: 0, uteis: 0, paraRevisar: 0,
  descartados: 0, jaExistentes: 0, atual: null, percentual: null, atualizadoEm: new Date().toISOString(),
});

/** Progresso de uma busca que ainda não começou (ou não existe). */
export const progressoInicial = vazio;

function comPercentual(p: ProgressoBusca): ProgressoBusca {
  const percentual = p.etapa === 'concluida' ? 100 : p.etapa === 'processando' && p.total > 0 ? Math.min(99, Math.round((p.verificados / p.total) * 100)) : null;
  return { ...p, percentual, atualizadoEm: new Date().toISOString() };
}

export type ResultadoItem = 'ja_existia' | 'descartado' | 'edital_util' | 'edital_revisar' | 'edital';

export interface AcumuladorBusca {
  ler(): ProgressoBusca;
  comecarColeta(): void;
  comecarProcessamento(total: number): void;
  registrarItem(resultado: ResultadoItem, titulo?: string | null): void;
  terminarBusca(falhou?: boolean): void;
}

/** Contagem de uma busca. Cada execução cria o seu, então duas buscas nunca dividem números. */
export function criarAcumuladorBusca(): AcumuladorBusca {
  let atual = vazio();
  const gravar = (p: ProgressoBusca) => {
    atual = comPercentual(p);
  };
  return {
    ler: () => ({ ...atual }),
    comecarColeta: () => gravar({ ...vazio(), etapa: 'coletando' }),
    comecarProcessamento: (total) => gravar({ ...atual, etapa: 'processando', total }),
    registrarItem(resultado, titulo = null) {
      const p = { ...atual, atual: titulo, verificados: atual.verificados + 1 };
      if (resultado === 'ja_existia') p.jaExistentes++;
      else if (resultado === 'descartado') p.descartados++;
      else {
        p.saoEditais++;
        if (resultado === 'edital_util') p.uteis++;
        if (resultado === 'edital_revisar') p.paraRevisar++;
      }
      gravar(p);
    },
    terminarBusca: (falhou = false) => gravar({ ...atual, etapa: falhou ? 'erro' : 'concluida', atual: null }),
  };
}

// Compatibilidade: API antiga de módulo (usada só pelo teste progresso-busca.test.ts).
// Estado num acumulador do processo, sem globalThis. Código de produção usa criarAcumuladorBusca.
const acumuladorPadrao = criarAcumuladorBusca();
/** @deprecated Use criarAcumuladorBusca(). */
export const lerProgresso = () => acumuladorPadrao.ler();
/** @deprecated Use criarAcumuladorBusca(). */
export const comecarColeta = () => acumuladorPadrao.comecarColeta();
/** @deprecated Use criarAcumuladorBusca(). */
export const comecarProcessamento = (total: number) => acumuladorPadrao.comecarProcessamento(total);
/** @deprecated Use criarAcumuladorBusca(). */
export const registrarItem = (resultado: ResultadoItem, titulo: string | null = null) => acumuladorPadrao.registrarItem(resultado, titulo);
/** @deprecated Use criarAcumuladorBusca(). */
export const terminarBusca = (falhou = false) => acumuladorPadrao.terminarBusca(falhou);

/** Classifica um item novo já processado para a contagem da barra. */
export function resultadoDoItem(statusAnalise: string | undefined, score: number): ResultadoItem {
  if (statusAnalise === 'descartado') return 'descartado';
  if (statusAnalise === 'duvida') return 'edital_revisar';
  return score >= SCORE_MEDIO && statusAnalise !== 'sem_pdf' ? 'edital_util' : 'edital';
}
