import { describe, it, expect } from 'vitest';
import { justificarHtml, citaSemReferencias } from '../lib/projetos/guias-secao';
import { gerarSecoes, aprimorarSecao, contarPreencher, semTituloRepetido, type ChamarIA } from '../lib/projetos/gerador-projeto';
import type { ContextoGeracao } from '../lib/projetos/contexto-geracao';

const ctx: ContextoGeracao = {
  edital: {
    titulo: 'Chamada X', orgao: 'CNPq', valorMax: 100000, prazoMeses: 24, objetivo: 'Fomentar pesquisa',
    criteriosAvaliacao: ['Mérito científico'], itensFinanciaveis: [], elegibilidade: [], secoesRequeridas: [],
  },
  proponente: { nome: 'Instituto Y', cnpj: '', historico: '', projetosAnteriores: [], certificacoes: [], capacidadeTecnica: '' },
  metricas: { publicoAlvo: '', localizacao: '', duracaoMeses: 12, beneficiariosDiretos: null, beneficiariosIndiretos: null, produtosEntregues: [], indicadoresImpacto: [] },
  proposta: { titulo: 'Projeto Z', descricao: 'desc', areaAtuacao: '', propostaUsuario: 'proposta' },
  pesquisa: true, persona: 'Você é um Pesquisador.', instrucoesExtras: '', fontes: '', referenciasInternas: '',
};

const secao = (chave: string, titulo: string, conteudo = '') => ({ id: chave, chave, titulo, conteudo });

function ia(respostas: (usuario: string) => string) {
  const chamadas: string[] = [];
  const chamar: ChamarIA = async (_s, u) => { chamadas.push(u); return respostas(u); };
  return { chamar, chamadas };
}

describe('gerador de projeto', () => {
  it('modo "vazias" não toca em seção com texto do usuário', async () => {
    const { chamar, chamadas } = ia(() => '<p>Texto gerado.</p>');
    const r = await gerarSecoes(ctx, [secao('justificativa', 'Justificativa', '<p>meu texto</p>'), secao('objetivos', 'Objetivos')], { modo: 'vazias', chamar });
    expect(Object.keys(r.secoes)).toEqual(['objetivos']);
    expect(chamadas).toHaveLength(1);
  });

  it('modo "todas" usa o texto do usuário como rascunho', async () => {
    const { chamar, chamadas } = ia(() => '<p>Novo.</p>');
    const r = await gerarSecoes(ctx, [secao('justificativa', 'Justificativa', '<p>meu texto</p>')], { modo: 'todas', chamar });
    expect(r.secoes.justificativa).toBe('<p style="text-align: justify;">Novo.</p>');
    expect(chamadas[0]).toContain('meu texto');
  });

  it('gera em ondas: objetivos antes do cronograma, resumo por último com as demais seções', async () => {
    const ordem: string[] = [];
    const { chamar } = ia(u => {
      const m = u.match(/SEÇÃO A ESCREVER: "([^"]+)"/);
      ordem.push(m![1]);
      return `<p>Texto de ${m![1]}.</p>`;
    });
    await gerarSecoes(ctx, [secao('resumo', 'Resumo executivo'), secao('cronograma', 'Cronograma'), secao('objetivos', 'Objetivos')], { modo: 'vazias', chamar });
    expect(ordem).toEqual(['Objetivos', 'Cronograma', 'Resumo executivo']);
  });

  it('repete quando o texto traz expressão proibida e limpa a cerca de código', async () => {
    let n = 0;
    const { chamar } = ia(() => (++n === 1 ? '<p>Uma jornada.</p>' : '```html\n<p>Texto limpo.</p>\n```'));
    const r = await gerarSecoes(ctx, [secao('objetivos', 'Objetivos')], { modo: 'vazias', chamar });
    expect(n).toBe(2);
    expect(r.secoes.objetivos).toBe('<p style="text-align: justify;">Texto limpo.</p>');
    expect(r.avisos).toEqual([]);
  });

  it('avisa sobre números que não estão no contexto', async () => {
    const { chamar } = ia(() => '<p>Atende 600 pessoas.</p>');
    const r = await gerarSecoes(ctx, [secao('objetivos', 'Objetivos')], { modo: 'vazias', chamar });
    expect(r.avisos.join(' ')).toContain('600');
  });

  it('aprimorar devolve o texto novo e o pedido chega ao prompt', async () => {
    const { chamar, chamadas } = ia(() => '<p>Mais curto.</p>');
    const r = await aprimorarSecao(ctx, secao('objetivos', 'Objetivos', '<p>Antigo.</p>'), [], { pedido: 'deixar mais curto', chamar });
    expect(r.conteudoNovo).toBe('<p style="text-align: justify;">Mais curto.</p>');
    expect(chamadas[0]).toContain('deixar mais curto');
  });

  it('conta trechos a preencher', () => {
    expect(contarPreencher(['<p>[PREENCHER: CNPJ] e [PREENCHER: nome]</p>', '<p>ok</p>'])).toBe(2);
  });

  it('remove o título da seção quando a IA o repete no início', async () => {
    expect(semTituloRepetido('<h3>Justificativa</h3>\n<p>Texto.</p>', 'Justificativa')).toBe('<p>Texto.</p>');
    expect(semTituloRepetido('<h2>Apresentação</h2><p>A.</p>', 'apresentacao')).toBe('<p>A.</p>');
    expect(semTituloRepetido('<h3>Fase 1</h3><p>A.</p>', 'Metodologia')).toBe('<h3>Fase 1</h3><p>A.</p>');
    const { chamar } = ia(() => '<h3>Objetivos</h3><p>Geral.</p>');
    const r = await gerarSecoes(ctx, [secao('objetivos', 'Objetivos')], { modo: 'vazias', chamar });
    expect(r.secoes.objetivos).toBe('<p style="text-align: justify;">Geral.</p>');
  });

  it('justifica parágrafos e itens de lista sem duplicar estilo', () => {
    expect(justificarHtml('<p>A</p><ul><li>B</li></ul>')).toBe('<p style="text-align: justify;">A</p><ul><li style="text-align: justify;">B</li></ul>');
    expect(justificarHtml('<p style="margin: 0">A</p>')).toBe('<p style="text-align: justify; margin: 0">A</p>');
    expect(justificarHtml('<p style="text-align: center">A</p>')).toBe('<p style="text-align: center">A</p>');
  });

  it('exige lista de referências quando há citação', async () => {
    expect(citaSemReferencias('<p>Segundo dados [1], o problema cresce.</p>')).toBe(true);
    expect(citaSemReferencias('<p>Conforme (IBGE, 2022), houve queda.</p>')).toBe(true);
    expect(citaSemReferencias('<p>Sem citação.</p>')).toBe(false);
    expect(citaSemReferencias('<p>Dado [1].</p><h3>Referências</h3><ul><li>[1] IBGE. Censo. 2022.</li></ul>')).toBe(false);
    let n = 0;
    const { chamar, chamadas } = ia(() => (++n === 1 ? '<p>Dado [1].</p>' : '<p>Dado [1].</p><h3>Referências</h3><ul><li>[1] IBGE. Censo. 2022.</li></ul>'));
    const r = await gerarSecoes(ctx, [secao('justificativa', 'Justificativa')], { modo: 'vazias', chamar });
    expect(n).toBe(2);
    expect(chamadas[1]).toContain('sem a lista');
    expect(r.secoes.justificativa).toContain('Referências');
  });
});
