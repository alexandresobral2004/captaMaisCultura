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

let cachedWhitelist: WhitelistData | null = null;
let cachedBlacklist: BlacklistData | null = null;
let cachedCategorias: CategoriasData | null = null;

function getFilePath(filename: string): string {
  return path.join(process.cwd(), 'data', 'filtros', filename);
}

/**
 * Carrega e valida o JSON da Whitelist de TI.
 * Utiliza cache em memória para evitar leituras repetitivas do disco.
 */
export function loadWhitelist(forceReload = false): WhitelistData {
  if (cachedWhitelist && !forceReload) {
    return cachedWhitelist;
  }

  const filePath = getFilePath('whitelist-ti.json');
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Arquivo não encontrado no caminho: ${filePath}`);
    }
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(rawData);
    
    const result = WhitelistSchema.safeParse(parsed);
    if (!result.success) {
      const formattedErrors = result.error.issues
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      throw new Error(`Erro de validação do schema Zod: [${formattedErrors}]`);
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
 * Utiliza cache em memória para evitar leituras repetitivas do disco.
 */
export function loadBlacklist(forceReload = false): BlacklistData {
  if (cachedBlacklist && !forceReload) {
    return cachedBlacklist;
  }

  const filePath = getFilePath('blacklist-ti.json');
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Arquivo não encontrado no caminho: ${filePath}`);
    }
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(rawData);

    const result = BlacklistSchema.safeParse(parsed);
    if (!result.success) {
      const formattedErrors = result.error.issues
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      throw new Error(`Erro de validação do schema Zod: [${formattedErrors}]`);
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
 * Utiliza cache em memória para evitar leituras repetitivas do disco.
 */
export function loadCategorias(forceReload = false): CategoriasData {
  if (cachedCategorias && !forceReload) {
    return cachedCategorias;
  }

  const filePath = getFilePath('categorias-ti.json');
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Arquivo não encontrado no caminho: ${filePath}`);
    }
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(rawData);

    const result = CategoriasSchema.safeParse(parsed);
    if (!result.success) {
      const formattedErrors = result.error.issues
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      throw new Error(`Erro de validação do schema Zod: [${formattedErrors}]`);
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
 * Limpa o cache em memória das configurações dos filtros de TI.
 */
export function clearLoadersCache(): void {
  cachedWhitelist = null;
  cachedBlacklist = null;
  cachedCategorias = null;
}
