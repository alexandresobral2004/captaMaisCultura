import { loadBlacklist } from '../scraper/filtros/loaders';
import { analisarBlacklist, BlacklistResult } from '../scraper/filtros/blacklist-engine';
import { logger } from '../logger';

export { analisarBlacklist };
export type { BlacklistResult };

/**
 * Validação simplificada da Blacklist integrada ao pipeline.
 * Retorna false (bloqueado) apenas se a recomendação for expressamente 'bloquear' (severidade alta).
 * Em outros níveis de severidade, a penalização e auditoria ocorrem via logs e pontuação posterior.
 */
export function validarBlacklist(titulo: string, descricao: string): boolean {
  const result = analisarBlacklist(titulo, descricao);

  if (result.scoreNegativo > 0) {
    const matchedTermsStr = result.termosEncontrados
      .map((t) => `${t.termo} (efetivas: ${t.ocorrencias}x, peso: -${t.peso})`)
      .join(', ');
      
    const logMsg = `[Blacklist Auditoria] Edital: "${titulo.substring(0, 50)}..." | Score Negativo: -${result.scoreNegativo} | Severidade: ${result.severidade} | Recomendação: ${result.recomendacao} | Termos: ${matchedTermsStr}`;

    if (result.recomendacao === 'bloquear') {
      // Log de aviso/auditoria para descarte do edital
      logger.logWarning(logMsg, 'validacao_blacklist', 'skip', {
        titulo,
        resultadoBlacklist: result
      }).catch((err) => console.error('Erro ao salvar log de auditoria da blacklist:', err));

      console.warn(`   ⚠️ [Blacklist] Bloqueando edital: -${result.scoreNegativo} pontos. Motivos: ${result.motivos.join('; ')}`);
      return false;
    } else {
      // Log informativo para acompanhamento de penalidade/revisão
      logger.logInfo(logMsg, 'validacao_blacklist', undefined, {
        titulo,
        resultadoBlacklist: result
      }).catch((err) => console.error('Erro ao salvar log de auditoria da blacklist:', err));

      console.log(`   ℹ️ [Blacklist] Recomendação '${result.recomendacao}' aplicada: -${result.scoreNegativo} pontos.`);
    }
  }

  return true;
}

// Para manter compatibilidade com exportações existentes que podem usar como objeto estático:
export const BLACKLIST = {
  get [Symbol.iterator]() {
    const list = loadBlacklist().blacklist;
    return function* () {
      for (const item of list) {
        yield item;
      }
    };
  },
  map(callback: (value: string, index: number, array: string[]) => any) {
    return loadBlacklist().blacklist.map(callback);
  },
  forEach(callback: (value: string, index: number, array: string[]) => void) {
    loadBlacklist().blacklist.forEach(callback);
  },
  filter(callback: (value: string, index: number, array: string[]) => boolean) {
    return loadBlacklist().blacklist.filter(callback);
  },
  includes(searchElement: string, fromIndex?: number) {
    return loadBlacklist().blacklist.includes(searchElement, fromIndex);
  },
  get length() {
    return loadBlacklist().blacklist.length;
  }
};

export const EXCECOES_BLACKLIST = {
  get values() {
    return loadBlacklist().excecoes;
  }
};

// Se algum código fizer indexação direta ou usar como objeto simples:
Object.defineProperty(EXCECOES_BLACKLIST, 'saúde', { get: () => loadBlacklist().excecoes['saúde'] });
Object.defineProperty(EXCECOES_BLACKLIST, 'educação', { get: () => loadBlacklist().excecoes['educação'] });
Object.defineProperty(EXCECOES_BLACKLIST, 'ensino', { get: () => loadBlacklist().excecoes['ensino'] });
Object.defineProperty(EXCECOES_BLACKLIST, 'arquitetura', { get: () => loadBlacklist().excecoes['arquitetura'] });
Object.defineProperty(EXCECOES_BLACKLIST, 'gestão', { get: () => loadBlacklist().excecoes['gestão'] });
Object.defineProperty(EXCECOES_BLACKLIST, 'design', { get: () => loadBlacklist().excecoes['design'] });
Object.defineProperty(EXCECOES_BLACKLIST, 'comunicação', { get: () => loadBlacklist().excecoes['comunicação'] });
Object.defineProperty(EXCECOES_BLACKLIST, 'administração', { get: () => loadBlacklist().excecoes['administração'] });
Object.defineProperty(EXCECOES_BLACKLIST, 'direito', { get: () => loadBlacklist().excecoes['direito'] });
Object.defineProperty(EXCECOES_BLACKLIST, 'agricultura', { get: () => loadBlacklist().excecoes['agricultura'] });
Object.defineProperty(EXCECOES_BLACKLIST, 'agropecuária', { get: () => loadBlacklist().excecoes['agropecuária'] });
Object.defineProperty(EXCECOES_BLACKLIST, 'arte', { get: () => loadBlacklist().excecoes['arte'] });