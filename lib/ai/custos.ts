import { custoUsd } from './precos';

/** Linha da tabela uso_ia, como sai do banco. Função pura: sem I/O. */
export interface LinhaUso {
  origem: string;
  modelo: string;
  tokensEntrada: number;
  tokensSaida: number;
  editalId: string | null;
  projetoId: string | null;
}

export interface ResumoFase {
  origem: string;
  chamadas: number;
  tokensEntrada: number;
  tokensSaida: number;
  custoUsd: number;
  semPreco: number;
}

export interface ResumoEdital {
  editalId: string;
  chamadas: number;
  custoUsd: number;
  semPreco: number;
  porFase: { origem: string; chamadas: number; custoUsd: number }[];
}

export interface TotalCustos {
  chamadas: number;
  tokensEntrada: number;
  tokensSaida: number;
  custoUsd: number;
  semPreco: number;
}

export interface AgregacaoCustos {
  porFase: ResumoFase[];
  porEdital: ResumoEdital[];
  total: TotalCustos;
}

/**
 * Agrupa as chamadas por fase e por edital. Modelo sem preço não entra no custo,
 * mas é contado em semPreco para o painel não mostrar um custo menor que o real sem aviso.
 */
export function agregarCustos(linhas: LinhaUso[]): AgregacaoCustos {
  const fases = new Map<string, ResumoFase>();
  const editais = new Map<string, { chamadas: number; custoUsd: number; semPreco: number; fases: Map<string, { chamadas: number; custoUsd: number }> }>();
  const total: TotalCustos = { chamadas: 0, tokensEntrada: 0, tokensSaida: 0, custoUsd: 0, semPreco: 0 };

  for (const l of linhas) {
    const custo = custoUsd(l.modelo, l.tokensEntrada, l.tokensSaida);
    const valor = custo ?? 0;

    const fase = fases.get(l.origem) ?? { origem: l.origem, chamadas: 0, tokensEntrada: 0, tokensSaida: 0, custoUsd: 0, semPreco: 0 };
    fase.chamadas += 1;
    fase.tokensEntrada += l.tokensEntrada;
    fase.tokensSaida += l.tokensSaida;
    fase.custoUsd += valor;
    if (custo === null) fase.semPreco += 1;
    fases.set(l.origem, fase);

    total.chamadas += 1;
    total.tokensEntrada += l.tokensEntrada;
    total.tokensSaida += l.tokensSaida;
    total.custoUsd += valor;
    if (custo === null) total.semPreco += 1;

    if (l.editalId) {
      const edital = editais.get(l.editalId) ?? { chamadas: 0, custoUsd: 0, semPreco: 0, fases: new Map() };
      edital.chamadas += 1;
      edital.custoUsd += valor;
      if (custo === null) edital.semPreco += 1;
      const faseEdital = edital.fases.get(l.origem) ?? { chamadas: 0, custoUsd: 0 };
      faseEdital.chamadas += 1;
      faseEdital.custoUsd += valor;
      edital.fases.set(l.origem, faseEdital);
      editais.set(l.editalId, edital);
    }
  }

  return {
    porFase: Array.from(fases.values()).sort((a, b) => b.custoUsd - a.custoUsd || a.origem.localeCompare(b.origem)),
    porEdital: Array.from(editais.entries()).map(([editalId, e]) => ({
      editalId,
      chamadas: e.chamadas,
      custoUsd: e.custoUsd,
      semPreco: e.semPreco,
      porFase: Array.from(e.fases.entries())
        .map(([origem, f]) => ({ origem, ...f }))
        .sort((a, b) => b.custoUsd - a.custoUsd || a.origem.localeCompare(b.origem)),
    })).sort((a, b) => b.custoUsd - a.custoUsd || a.editalId.localeCompare(b.editalId)),
    total,
  };
}
