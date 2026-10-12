import type { Edital } from '../db/editais-store';
import { PortalService } from '../database/services/portal.service';
import type { EixoPortal, ResultadoTriagem } from './index';

/**
 * Eixo configurado para o portal (auto, Cultura ou Pesquisa).
 * Aceita o id do portal; se não existir, ou se a leitura falhar, assume 'auto'.
 */
export async function obterEixoPortal(portalId: string): Promise<EixoPortal> {
  try {
    const portal = await new PortalService().buscarPorId(portalId);
    return portal?.eixo ?? 'auto';
  } catch {
    return 'auto';
  }
}

/**
 * Traduz o resultado da triagem para os campos do Edital que dependem dela
 * (eixo, classificação de TI, validação por IA e marcação de dúvida).
 */
export function camposTriagemParaEdital(t: ResultadoTriagem): Partial<Edital> {
  const ia = t.validacaoIA && t.validacaoIA.ok ? t.validacaoIA : undefined;
  return {
    categoriaArea: t.categoriaArea ?? undefined,
    tecnologiaFoco: ia?.tecnologia,
    tipoFerramenta: ia?.tipo,
    scoreRelevancia: ia?.score ?? 0,
    scoreConfiancaIA: ia?.confiança ?? 0,
    validadoPorIA: !t.incerto,
    palavrasChaveEncontradas: t.termosBranco,
    dataValidacaoIA: new Date().toISOString(),
    statusAnalise: t.incerto ? 'duvida' : undefined,
    foraDoEscopo: t.incerto ? null : false,
    motivosPontuacao: t.incerto ? [`Classificação com baixa certeza: ${t.motivo}`] : undefined,
  };
}
