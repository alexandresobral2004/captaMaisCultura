import { describe, it, expect } from 'vitest';
import { validarDocumentoEdital } from '../lib/scraper/validacao-documento';

const TITULO = 'Edital 02/2026 - Programa de Fomento à Cultura';
const ACEITA_TUDO = async () => 0.99;

// Documento com palavras de edital suficientes para passar pela regra de grupos
const CORPO = 'DO OBJETO: fomentar projetos culturais. INSCRIÇÕES até 30/11/2026. Podem participar proponentes pessoas jurídicas. Recursos financeiros: valor máximo de R$ 150.000,00. Critérios de seleção: mérito cultural.';

describe('o documento precisa ser deste edital, e não de outro', () => {
  it('descarta o resultado de outro edital, mesmo com palavras de edital', async () => {
    const texto = `RESULTADO FINAL DO EDITAL Nº 05/2026. ${CORPO}`;

    const r = await validarDocumentoEdital({ titulo: TITULO, orgao: 'Minc', texto }, ACEITA_TUDO);

    expect(r.decisao).toBe('descartado');
    expect(r.motivo).toMatch(/outro edital/);
  });

  it('aceita o documento que cita o número do edital do título', async () => {
    const texto = `EDITAL Nº 02/2026. ${CORPO}`;

    const r = await validarDocumentoEdital({ titulo: TITULO, orgao: 'Minc', texto }, ACEITA_TUDO);

    expect(r.decisao).toBe('valido');
  });

  it('não aceita sozinho documento que nunca cita o número do edital: vai para revisão', async () => {
    const texto = `EDITAL DE CHAMADA PÚBLICA. ${CORPO}`;

    const r = await validarDocumentoEdital({ titulo: TITULO, orgao: 'Minc', texto }, ACEITA_TUDO);

    expect(r.decisao).toBe('duvida');
    expect(r.motivo).toMatch(/não cita o nº/);
  });

  it('sem número no título, a validação segue como antes', async () => {
    const texto = `EDITAL DE CHAMADA PÚBLICA. ${CORPO}`;

    const r = await validarDocumentoEdital({ titulo: 'Programa de Fomento à Cultura', orgao: 'Minc', texto }, ACEITA_TUDO);

    expect(r.decisao).toBe('valido');
  });
});
