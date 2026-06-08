import { describe, it, expect } from 'vitest';
import { ProposalWithRigidConstraintsEngine, SectionOutput } from '../../lib/ai/engines/proposal-writer.engine';

describe('ProposalWithRigidConstraintsEngine', () => {
  it('deve validar o número de parágrafos corretamente', () => {
    const engine = new ProposalWithRigidConstraintsEngine();
    
    const validOutput: SectionOutput = {
      paragraphs: [
        "O diagnóstico aponta falta de infraestrutura tecnológica nas escolas públicas locais.",
        "A solução implementará computadores e capacitação técnica nas salas de aula.",
        "A instituição possui capacidade técnica comprovada por certidões anteriores.",
        "O impacto esperado é a inclusão digital da população jovem da região."
      ],
      metadata: { wordCount: 200, paragraphCount: 4, dataSourcesUsed: [] }
    };

    // Não deve lançar erro
    expect(() => {
      engine.validateOutputConstraints(validOutput, 4, 5);
    }).not.toThrow();

    // Deve lançar erro se fora do range
    expect(() => {
      engine.validateOutputConstraints(validOutput, 1, 2);
    }).toThrowError(/Violou restrição estrutural/);
  });

  it('deve rejeitar textos contendo palavras vazias ou adjetivação poética', () => {
    const engine = new ProposalWithRigidConstraintsEngine();
    
    const flawedOutput: SectionOutput = {
      paragraphs: [
        "O diagnóstico aponta falta de infraestrutura tecnológica nas escolas públicas locais.",
        "Nossa solução implementará um projeto maravilhoso e revolucionário para mudar vidas.",
        "A instituição possui capacidade técnica comprovada por certidões anteriores.",
        "O impacto esperado é a inclusão digital completa da população jovem da região."
      ],
      metadata: { wordCount: 200, paragraphCount: 4, dataSourcesUsed: [] }
    };

    expect(() => {
      engine.validateOutputConstraints(flawedOutput, 4, 5);
    }).toThrowError(/Violou barreira de qualidade: O texto contém adjetivação proibida/);
  });

  it('deve validar especificidade e frases longas através de avisos sem lançar erro', () => {
    const engine = new ProposalWithRigidConstraintsEngine();
    
    const okOutput: SectionOutput = {
      paragraphs: [
        // Sem dados numéricos ou geográficos, e com frase longa (> 25 palavras)
        "Esta é uma frase de teste propositalmente longa para verificar se o sistema detecta corretamente períodos que excedem vinte e cinco palavras consecutivas sem pontuação adequada para que possamos validar o aviso no console."
      ],
      metadata: { wordCount: 50, paragraphCount: 1, dataSourcesUsed: [] }
    };

    // A validação de especificidade e frases longas só exibe aviso no console (console.warn), não lança erro
    expect(() => {
      engine.validateOutputConstraints(okOutput, 1, 1);
    }).not.toThrow();
  });
});
