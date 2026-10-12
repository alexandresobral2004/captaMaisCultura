import type { Edital } from '../db/editais-store';
import { PortalService } from '../database/services/portal.service';
import { triarEdital, type EixoPortal, type ResultadoTriagem, type EntradaTriagem } from './index';

/**
 * Eixo configurado para o portal (auto, Cultura ou Pesquisa).
 * Aceita o id do portal; se não existir, ou se a leitura falhar, assume 'auto'.
 */
const TTL_EIXO_MS = 60_000;
const cacheEixo = new Map<string, { eixo: EixoPortal; ate: number }>();

export async function obterEixoPortal(portalId: string): Promise<EixoPortal> {
  const guardado = cacheEixo.get(portalId);
  if (guardado && guardado.ate > Date.now()) return guardado.eixo;
  let eixo: EixoPortal = 'auto';
  try {
    const portal = await new PortalService().buscarPorId(portalId);
    eixo = portal?.eixo ?? 'auto';
  } catch {
    // mantém 'auto'
  }
  cacheEixo.set(portalId, { eixo, ate: Date.now() + TTL_EIXO_MS });
  return eixo;
}

/**
 * Triagem de um edital de um portal: usa o eixo configurado e nunca lança.
 * Uma falha da triagem rejeita só aquele edital, sem derrubar a varredura do portal.
 */
export async function triarEditalDoPortal(
  portalId: string,
  entrada: Omit<EntradaTriagem, 'eixoPortal'>
): Promise<ResultadoTriagem> {
  try {
    return await triarEdital({ ...entrada, eixoPortal: await obterEixoPortal(portalId) });
  } catch (erro) {
    const msg = (erro as Error).message;
    console.warn(`   ⚠️ Triagem falhou para "${entrada.titulo.substring(0, 40)}": ${msg}`);
    return { aceito: false, incerto: false, categoriaArea: null, etapa: 'eixo', motivo: `Erro na triagem: ${msg}`, termosBranco: [] };
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
