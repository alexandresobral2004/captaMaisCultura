import { describe, it, expect } from 'vitest';
import { mensagemErroAnalise } from '@/lib/ai/erros-analise';

describe('mensagemErroAnalise', () => {
  it('traduz erros técnicos', () => {
    expect(mensagemErroAnalise(new Error('429 rate_limit_exceeded'))).toMatch(/muitas consultas/);
    expect(mensagemErroAnalise(new Error('timeout of 15000ms exceeded'))).toMatch(/demorou demais/);
    expect(mensagemErroAnalise(new Error('getaddrinfo ENOTFOUND x.gov.br'))).toMatch(/não respondeu/);
    expect(mensagemErroAnalise(new Error('PDF sem texto extraível (provavelmente digitalizado/escaneado).'))).toMatch(/imagem/);
    expect(mensagemErroAnalise('OPENAI_API_KEY não configurada')).toMatch(/chave da OpenAI/);
    expect(mensagemErroAnalise(new Error('algo estranho'))).toMatch(/Não foi possível analisar/);
  });
});
