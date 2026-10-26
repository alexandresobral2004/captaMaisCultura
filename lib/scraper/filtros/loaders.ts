import fs from 'fs';
import path from 'path';
import {
  WhitelistSchema,
  BlacklistSchema,
  CategoriasSchema,
  WhitelistData,
  BlacklistData,
  CategoriasData
} from './types';
import { lerConfiguracao, gravarConfiguracao } from '../../config/configuracoes';

type NomeFiltro = 'whitelist' | 'blacklist' | 'categorias';

const ARQUIVOS: Record<NomeFiltro, string> = {
  whitelist: 'whitelist-ti.json',
  blacklist: 'blacklist-ti.json',
  categorias: 'categorias-ti.json',
};

let cachedWhitelist: WhitelistData | null = null;
let cachedBlacklist: BlacklistData | null = null;
let cachedCategorias: CategoriasData | null = null;

/**
 * Conteúdo mais recente vindo do banco (tabela `configuracoes`, chave `filtros.<nome>`).
 * Preenchido por sincronizarFiltros() no start do servidor e por gravarFiltro() nas rotas.
 * Os loaders são síncronos, então leem daqui; o arquivo do repositório é só o fallback.
 */
const memoria: Partial<Record<NomeFiltro, unknown>> = {};

function getFilePath(filename: string): string {
  return path.join(process.cwd(), 'data', 'filtros', filename);
}

function lerFonte(nome: NomeFiltro, filePath: string): unknown {
  if (memoria[nome] !== undefined) return memoria[nome];
  if (!fs.existsSync(filePath)) {
    throw new Error(`Arquivo não encontrado no caminho: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function formatarErrosZod(error: { issues: { path: PropertyKey[]; message: string }[] }): string {
  return error.issues.map((e) => `${e.path.map(String).join('.')}: ${e.message}`).join(', ');
}

/**
 * Carrega e valida o JSON da Whitelist de TI.
 * Utiliza cache em memória para evitar leituras repetitivas.
 */
export function loadWhitelist(forceReload = false): WhitelistData {
  if (cachedWhitelist && !forceReload) {
    return cachedWhitelist;
  }

  const filePath = getFilePath(ARQUIVOS.whitelist);
  try {
    const result = WhitelistSchema.safeParse(lerFonte('whitelist', filePath));
    if (!result.success) {
      throw new Error(`Erro de validação do schema Zod: [${formatarErrosZod(result.error)}]`);
    }

    cachedWhitelist = result.data;
    return cachedWhitelist;
  } catch (error: any) {
    throw new Error(
      `[Filtros TI] Falha crítica ao carregar a whitelist (${filePath}): ${error.message}`
    );
  }
}

/**
 * Carrega e valida o JSON da Blacklist de TI.
 * Utiliza cache em memória para evitar leituras repetitivas.
 */
export function loadBlacklist(forceReload = false): BlacklistData {
  if (cachedBlacklist && !forceReload) {
    return cachedBlacklist;
  }

  const filePath = getFilePath(ARQUIVOS.blacklist);
  try {
    const result = BlacklistSchema.safeParse(lerFonte('blacklist', filePath));
    if (!result.success) {
      throw new Error(`Erro de validação do schema Zod: [${formatarErrosZod(result.error)}]`);
    }

    cachedBlacklist = result.data;
    return cachedBlacklist;
  } catch (error: any) {
    throw new Error(
      `[Filtros TI] Falha crítica ao carregar a blacklist (${filePath}): ${error.message}`
    );
  }
}

/**
 * Carrega e valida o JSON de Categorias e Regras de TI.
 * Utiliza cache em memória para evitar leituras repetitivas.
 */
export function loadCategorias(forceReload = false): CategoriasData {
  if (cachedCategorias && !forceReload) {
    return cachedCategorias;
  }

  const filePath = getFilePath(ARQUIVOS.categorias);
  try {
    const result = CategoriasSchema.safeParse(lerFonte('categorias', filePath));
    if (!result.success) {
      throw new Error(`Erro de validação do schema Zod: [${formatarErrosZod(result.error)}]`);
    }

    cachedCategorias = result.data;
    return cachedCategorias;
  } catch (error: any) {
    throw new Error(
      `[Filtros TI] Falha crítica ao carregar as categorias/regras (${filePath}): ${error.message}`
    );
  }
}

/**
 * Carrega os filtros do banco para a memória. Na primeira execução, semeia o banco
 * com o arquivo que vem no repositório. Depois disso, o banco é a fonte da verdade.
 */
export async function sincronizarFiltros(): Promise<void> {
  for (const nome of Object.keys(ARQUIVOS) as NomeFiltro[]) {
    const chave = `filtros.${nome}`;
    const doBanco = await lerConfiguracao<unknown>(chave);
    if (doBanco !== null) {
      memoria[nome] = doBanco;
      continue;
    }

    const arquivo = getFilePath(ARQUIVOS[nome]);
    if (fs.existsSync(arquivo)) {
      const semente = JSON.parse(fs.readFileSync(arquivo, 'utf-8'));
      await gravarConfiguracao(chave, semente);
      memoria[nome] = semente;
    }
  }
  clearLoadersCache();
}

/** Grava um filtro no banco, atualiza a memória e invalida o cache dos loaders. */
export async function gravarFiltro(nome: NomeFiltro, dados: unknown): Promise<void> {
  await gravarConfiguracao(`filtros.${nome}`, dados);
  memoria[nome] = dados;
  clearLoadersCache();
}

/**
 * Limpa o cache dos objetos já validados. Não apaga a memória com o conteúdo do banco,
 * senão os loaders voltariam a ler o arquivo do repositório.
 */
export function clearLoadersCache(): void {
  cachedWhitelist = null;
  cachedBlacklist = null;
  cachedCategorias = null;
}
