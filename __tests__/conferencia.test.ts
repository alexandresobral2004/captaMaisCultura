import { describe, it, expect } from 'vitest';
import { secoesFaltando, avisosConferencia } from '../lib/projetos/conferencia';

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
});
