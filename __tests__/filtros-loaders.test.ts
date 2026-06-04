import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { loadWhitelist, loadBlacklist, loadCategorias, clearLoadersCache } from '../lib/scraper/filtros/loaders';

describe('IT Filters Loaders', () => {
  beforeEach(() => {
    clearLoadersCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deve carregar a whitelist com sucesso e validar com Zod', () => {
    const whitelist = loadWhitelist();
    expect(whitelist).toBeDefined();
    expect(Array.isArray(whitelist.tecnologia)).toBe(true);
    expect(Array.isArray(whitelist.contexto_institucional)).toBe(true);
    expect(Array.isArray(whitelist.contexto_geral)).toBe(true);
    expect(whitelist.tecnologia.length).toBeGreaterThan(0);
  });

  it('deve usar cache na segunda chamada de loadWhitelist', () => {
    const readSpy = vi.spyOn(fs, 'readFileSync');
    
    // Primeira chamada (lê do disco)
    const w1 = loadWhitelist();
    expect(readSpy).toHaveBeenCalledTimes(1);
    
    // Segunda chamada (retorna do cache)
    const w2 = loadWhitelist();
    expect(readSpy).toHaveBeenCalledTimes(1);
    expect(w1).toBe(w2);
  });

  it('deve recarregar do disco se forceReload for true', () => {
    const readSpy = vi.spyOn(fs, 'readFileSync');
    
    loadWhitelist();
    expect(readSpy).toHaveBeenCalledTimes(1);
    
    loadWhitelist(true);
    expect(readSpy).toHaveBeenCalledTimes(2);
  });

  it('deve carregar a blacklist e exceções com sucesso', () => {
    const blacklist = loadBlacklist();
    expect(blacklist).toBeDefined();
    expect(Array.isArray(blacklist.blacklist)).toBe(true);
    expect(blacklist.excecoes).toBeTypeOf('object');
    expect(blacklist.blacklist.length).toBeGreaterThan(0);
    expect(blacklist.excecoes['saúde']).toContain('healthtech');
  });

  it('deve carregar e validar as categorias e regras de inferência', () => {
    const categorias = loadCategorias();
    expect(categorias).toBeDefined();
    expect(categorias.normalizacaoTecnologia).toBeTypeOf('object');
    expect(categorias.normalizacaoTipo).toBeTypeOf('object');
    expect(Array.isArray(categorias.regrasInferenciaTecnologia)).toBe(true);
    expect(Array.isArray(categorias.regrasInferenciaTipo)).toBe(true);
  });

  it('deve falhar com erro amigável se o arquivo JSON não existir', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    expect(() => loadWhitelist(true)).toThrowError(/Arquivo não encontrado/);
  });

  it('deve falhar com erro de validação do Zod se o JSON for inválido', () => {
    // Mock para retornar JSON inválido
    vi.spyOn(fs, 'readFileSync').mockReturnValue('{"tecnologia": "não é um array"}');
    expect(() => loadWhitelist(true)).toThrowError(/Erro de validação do schema Zod/);
  });
});
