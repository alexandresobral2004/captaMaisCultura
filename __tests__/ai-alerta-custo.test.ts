import { describe, it, expect } from 'vitest';
import { avaliarAlerta, limiteAlertaUsd, inicioDoMesIso, deveNotificarCustoMensal } from '../lib/ai/alerta-custo';

describe('deveNotificarCustoMensal', () => {
  it('notifica quando o total passa do limite e o mês ainda não foi avisado', () => {
    expect(deveNotificarCustoMensal(16, 15, false)).toBe(true);
  });

  it('não notifica de novo no mesmo mês', () => {
    expect(deveNotificarCustoMensal(16, 15, true)).toBe(false);
  });

  it('não notifica quando o total está no limite ou abaixo', () => {
    expect(deveNotificarCustoMensal(15, 15, false)).toBe(false);
    expect(deveNotificarCustoMensal(3, 15, false)).toBe(false);
  });
});

describe('avaliarAlerta', () => {
  it('marca ultrapassou quando o total passa do limite', () => {
    expect(avaliarAlerta(15.01, 15)).toEqual({ ultrapassou: true, totalUsd: 15.01, limiteUsd: 15 });
  });

  it('não marca quando o total é igual ou menor que o limite', () => {
    expect(avaliarAlerta(15, 15).ultrapassou).toBe(false);
    expect(avaliarAlerta(3, 15).ultrapassou).toBe(false);
  });
});

describe('limiteAlertaUsd', () => {
  it('usa 15 quando CUSTO_IA_ALERTA_USD não está definida', () => {
    expect(limiteAlertaUsd({})).toBe(15);
  });

  it('lê o valor da variável de ambiente', () => {
    expect(limiteAlertaUsd({ CUSTO_IA_ALERTA_USD: '20.5' })).toBe(20.5);
  });

  it('cai no padrão quando o valor é inválido ou negativo', () => {
    expect(limiteAlertaUsd({ CUSTO_IA_ALERTA_USD: 'abc' })).toBe(15);
    expect(limiteAlertaUsd({ CUSTO_IA_ALERTA_USD: '-3' })).toBe(15);
  });
});

describe('inicioDoMesIso', () => {
  it('devolve o dia 1 do mês corrente às 00:00 UTC', () => {
    expect(inicioDoMesIso(new Date('2026-11-17T15:30:00Z'))).toBe('2026-11-01T00:00:00.000Z');
  });
});
