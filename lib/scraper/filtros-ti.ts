export {
  TecnologiaFoco,
  TipoFerramenta,
  validarWhitelistTI,
  WHITELIST_TI,
  validarBlacklist,
  BLACKLIST,
  EXCECOES_BLACKLIST,
  analisarBlacklist,
  validarComOpenAI,
  gerarFallbackAceitar,
  inferirTecnologiaPorContexto,
  inferirTipoFerramentaPorContexto,
  normalizarTecnologia,
  normalizarTipo,
  calcularScoreFinal,
  cacheValidacao,
  gerarChaveCache,
  limparCache
} from '../filtros-ti/index';
export type { BlacklistResult, AiClassificationResult } from '../filtros-ti/index';