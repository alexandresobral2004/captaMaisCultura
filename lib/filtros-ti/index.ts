export { TecnologiaFoco, TipoFerramenta } from './enums';

export { validarWhitelistTI, WHITELIST_TI } from './whitelist';

export { validarBlacklist, BLACKLIST, EXCECOES_BLACKLIST, analisarBlacklist } from './blacklist';
export type { BlacklistResult } from './blacklist';

export {
  validarComOpenAI,
  gerarFallbackAceitar,
  inferirTecnologiaPorContexto,
  inferirTipoFerramentaPorContexto,
  normalizarTecnologia,
  normalizarTipo,
  calcularScoreFinal
} from './openai-classifier';
export type { AiClassificationResult } from './openai-classifier';

export {
  cacheValidacao,
  gerarChaveCache,
  limparCache
} from './cache';