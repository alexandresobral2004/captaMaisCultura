import { SCORE_MEDIO } from '../triagem/limiares';

/**
 * Andamento da busca por novos editais, lido pela tela enquanto a busca roda.
 * Fica em memória do servidor (globalThis, para sobreviver ao recarregamento de módulos do Next).
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

const g = globalThis as unknown as { __progressoBusca?: ProgressoBusca };

export function lerProgresso(): ProgressoBusca {
  return g.__progressoBusca ?? vazio();
}

function gravar(p: ProgressoBusca) {
  p.percentual = p.etapa === 'concluida' ? 100 : p.etapa === 'processando' && p.total > 0 ? Math.min(99, Math.round((p.verificados / p.total) * 100)) : null;
  p.atualizadoEm = new Date().toISOString();
  g.__progressoBusca = p;
}

export function comecarColeta() {
  gravar({ ...vazio(), etapa: 'coletando' });
}

export function comecarProcessamento(total: number) {
  gravar({ ...lerProgresso(), etapa: 'processando', total });
}

export type ResultadoItem = 'ja_existia' | 'descartado' | 'edital_util' | 'edital_revisar' | 'edital';

export function registrarItem(resultado: ResultadoItem, titulo: string | null = null) {
  const p = { ...lerProgresso(), atual: titulo };
  p.verificados++;
  if (resultado === 'ja_existia') p.jaExistentes++;
  else if (resultado === 'descartado') p.descartados++;
  else {
    p.saoEditais++;
    if (resultado === 'edital_util') p.uteis++;
    if (resultado === 'edital_revisar') p.paraRevisar++;
  }
  gravar(p);
}

export function terminarBusca(falhou = false) {
  gravar({ ...lerProgresso(), etapa: falhou ? 'erro' : 'concluida', atual: null });
}

/** Classifica um item novo já processado para a contagem da barra. */
export function resultadoDoItem(statusAnalise: string | undefined, score: number): ResultadoItem {
  if (statusAnalise === 'descartado') return 'descartado';
  if (statusAnalise === 'duvida') return 'edital_revisar';
  return score >= SCORE_MEDIO && statusAnalise !== 'sem_pdf' ? 'edital_util' : 'edital';
}
