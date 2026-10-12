import { describe, it, expect } from 'vitest';
import { secoesFaltando, avisosConferencia, calcularNota, conferirProjeto, ConferenciaErro } from '../lib/projetos/conferencia';

const texto = 'x'.repeat(60);

describe('conferência do projeto', () => {
  it('ignora acento e maiúsculas no título da seção', () => {
    const faltam = secoesFaltando(['Orçamento', 'Cronograma'], [{ titulo: 'ORCAMENTO detalhado', texto }]);
    expect(faltam).toEqual(['Cronograma']);
  });
  it('seção sem texto conta como faltando', () => {
    expect(secoesFaltando(['Metodologia'], [{ titulo: 'Metodologia', texto: '' }])).toEqual(['Metodologia']);
  });
  it('avisa valor acima do teto e participação restrita', () => {
    const a = avisosConferencia({ valorSolicitado: 200000, valorMax: 100000, restritoA: 'Institutos Federais' });
    expect(a).toHaveLength(2);
    expect(avisosConferencia({ valorSolicitado: 50, valorMax: 100 })).toEqual([]);
  });

  it('calcula a nota: atendido vale 1, parcial vale meio', () => {
    const c = (situacao: 'atendido' | 'parcial' | 'ausente') => ({ criterio: 'x', situacao, observacao: '' });
    expect(calcularNota([c('atendido'), c('parcial'), c('ausente'), c('atendido')])).toBe(63);
    expect(calcularNota([])).toBe(0);
  });

  it('confere o projeto com a IA simulada e recusa edital sem análise', async () => {
    const projeto = {
      valorSolicitado: 10, edital: { valorMax: 100, analiseIA: { secoesRequeridas: ['Justificativa', 'Cronograma'], criteriosAvaliacao: ['Mérito'] } },
      secoesDinamicas: [{ titulo: 'Justificativa', conteudo: '<p>' + 'texto '.repeat(20) + '</p>' }],
    };
    const r = await conferirProjeto(projeto, async () => JSON.stringify({ criterios: [{ situacao: 'atendido', observacao: 'ok' }] }));
    expect(r.secoesFaltando).toEqual(['Cronograma']);
    expect(r.nota).toBe(100);
    await expect(conferirProjeto({ edital: {} }, async () => '{}')).rejects.toBeInstanceOf(ConferenciaErro);
  });
});
