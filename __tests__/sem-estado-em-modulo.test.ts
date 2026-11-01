import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { arquivosTs } from './helpers/arquivos';

// Estado mutável no nível do módulo é compartilhado por todas as requisições do processo e não
// é visto pelas outras réplicas. Cada exceção precisa de motivo escrito aqui.
const PADROES: RegExp[] = [
  /^(?:export\s+)?let\s+(\w+)/gm,
  /^(?:export\s+)?const\s+(\w+)\s*(?::[^=\n]+)?=\s*new\s+(?:Map|Set|WeakMap)(?:<.*>)?\(\s*\)/gm,
  /^(setInterval|setTimeout)\(/gm,
];

/** Identificadores de estado em nível de módulo encontrados no conteúdo de um arquivo. */
export function estadoEmModulo(conteudo: string): string[] {
  return PADROES.flatMap((padrao) => Array.from(conteudo.matchAll(padrao), (m) => m[1]));
}

const ALLOWLIST: Readonly<Record<string, string>> = {
  'app/api/v1/portais/route.ts:migrationChecked':
    'Flag por processo para rodar a migração JSON→banco uma vez; a migração é idempotente.',
  'lib/scraper/config.ts:migrationDone': 'Flag por processo da migração JSON→banco, idempotente.',
  'lib/scraper/filtros/loaders.ts:cachedWhitelist': 'Cache de objeto validado; invalidado por clearLoadersCache() e recarregado do banco.',
  'lib/scraper/filtros/loaders.ts:cachedBlacklist': 'Cache de objeto validado; invalidado por clearLoadersCache() e recarregado do banco.',
  'lib/scraper/filtros/loaders.ts:cachedCategorias': 'Cache de objeto validado; invalidado por clearLoadersCache() e recarregado do banco.',
  'lib/scraper/filtros/termos.ts:cache': 'Cache de RegExp compiladas a partir de termos já validados; derivado, sem estado de negócio.',
  'lib/database/db.ts:_conn': 'Conexão única por processo, criada uma vez.',
  'lib/triagem/cultura.ts:cache': 'Cache das listas de cultura, carregadas uma vez por processo.',
  'lib/triagem/pontuacao.ts:regras': 'Regras carregadas uma vez por processo a partir do banco/arquivo.',
  'lib/triagem/pontuacao.ts:regexes': 'Cache de RegExp derivadas das regras; derivado, sem estado de negócio.',
  'lib/triagem/scraper.ts:cacheEixo': 'Débito conhecido: cache com TTL por processo; não é compartilhado entre réplicas.',
  'lib/filtros-ti/cache.ts:cacheValidacao': 'Cache de validação com TTL por processo.',
  'lib/analise-cientifica/writer.ts:instance': 'Instância singleton do serviço, sem estado de negócio compartilhado.',
  'lib/storage/armazenamento.ts:instancia': 'Instância singleton do armazenamento, sem estado de negócio compartilhado.',
  'lib/ai/client.ts:clienteEmCache': 'Cliente de IA reaproveitado enquanto a chave não muda.',
  'lib/jobs/scheduler.ts:taskAgendada': 'Handle da tarefa agendada; só o processo que agenda o mantém.',
  'lib/jobs/scheduler.ts:taskLimpezaLimites': 'Handle da tarefa de limpeza agendada; só o processo que agenda o mantém.',
};

interface ArquivoFonte {
  rel: string;
  conteudo: string;
}

/** Chaves `arquivo:identificador` de estado fora da allowlist. */
export function achadosForaDaAllowlist(arquivos: ArquivoFonte[]): string[] {
  return arquivos.flatMap((a) => estadoEmModulo(a.conteudo).map((id) => `${a.rel}:${id}`))
    .filter((chave) => !(chave in ALLOWLIST));
}

function lerFontesDoProjeto(): ArquivoFonte[] {
  const raiz = process.cwd();
  return ['app', 'lib'].flatMap((pasta) => arquivosTs(path.join(raiz, pasta))).map((abs) => ({
    rel: path.relative(raiz, abs),
    conteudo: fs.readFileSync(abs, 'utf8'),
  }));
}

describe('guarda: estado mutável em nível de módulo', () => {
  it('reconhece let, Map/Set vazios e timers na coluna 0', () => {
    expect(estadoEmModulo('let x = 1;')).toEqual(['x']);
    expect(estadoEmModulo('export let y;')).toEqual(['y']);
    expect(estadoEmModulo('const m = new Map();')).toEqual(['m']);
    expect(estadoEmModulo('export const s: Set<string> = new Set();')).toEqual(['s']);
    expect(estadoEmModulo('setInterval(() => {}, 1000);')).toEqual(['setInterval']);
  });

  it('ignora o que está dentro de função ou não é estado mutável', () => {
    expect(estadoEmModulo('function f() {\n  const m = new Map();\n  return m;\n}')).toEqual([]);
    expect(estadoEmModulo("const A = new Set(['a']);")).toEqual([]);
    expect(estadoEmModulo('const B = 1;')).toEqual([]);
  });

  it('pega um Map novo na coluna 0 de um arquivo novo em lib/ (fixture em memória)', () => {
    const achados = achadosForaDaAllowlist([
      { rel: 'lib/novo/cache-global.ts', conteudo: 'const porChave = new Map();\n' },
    ]);
    expect(achados).toEqual(['lib/novo/cache-global.ts:porChave']);
  });

  it('nenhum estado de módulo em app/ ou lib/ fora da allowlist', () => {
    expect(achadosForaDaAllowlist(lerFontesDoProjeto())).toEqual([]);
  });

  it('nenhuma entrada da allowlist está obsoleta', () => {
    const raiz = process.cwd();
    const encontrados = new Set(
      lerFontesDoProjeto().flatMap((a) => estadoEmModulo(a.conteudo).map((id) => `${a.rel}:${id}`))
    );
    const obsoletas = Object.keys(ALLOWLIST).filter((chave) => !encontrados.has(chave));
    expect(obsoletas.map((c) => `${c} (${fs.existsSync(path.join(raiz, c.split(':')[0])) ? 'arquivo existe' : 'arquivo sumiu'})`)).toEqual([]);
  });
});
