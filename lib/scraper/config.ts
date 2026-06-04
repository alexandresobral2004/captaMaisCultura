import fs from 'fs';
import path from 'path';
import { PortalService, PortalDTO, Portal } from '../database/services/portal.service';

export interface PortalConfig {
  id: string;
  nome: string;
  urlBusca: string;
  urlsFallback: string[];
  tipo: 'rss' | 'html' | 'api' | 'session';
  categoria: string;
  ativo: boolean;
  scraperModule?: string;
  intervaloMinutos: number;
  ultimoScan?: string;
  credEmail?: string;
}

const service = new PortalService();
const CONFIG_FILE = path.join(process.cwd(), 'data', 'portais-config.json');

let portaisCache: PortalConfig[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60000;
let migrationDone = false;

function lerJsonFallback(): PortalConfig[] {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      const portais = JSON.parse(data);
      return portais.map((p: any) => ({
        id: p.id,
        nome: p.nome,
        urlBusca: p.urlBusca,
        urlsFallback: p.urlsFallback || [],
        tipo: p.tipo || 'html',
        categoria: p.categoria || 'Geral',
        ativo: p.ativo !== false,
        scraperModule: p.scraperModule,
        intervaloMinutos: p.intervaloMinutos || 60,
        ultimoScan: p.ultimoScan,
        credEmail: p.credEmail,
      }));
    }
  } catch (error) {
    console.warn('Erro ao ler portais-config.json:', error);
  }
  return [];
}

export function getPortais(): PortalConfig[] {
  const now = Date.now();
  if (portaisCache && (now - cacheTimestamp) < CACHE_TTL) {
    return portaisCache as PortalConfig[];
  }

  try {
    const portais = service.listarSync();
    portaisCache = portais as unknown as PortalConfig[];
    cacheTimestamp = now;
    return portais as unknown as PortalConfig[];
  } catch (error) {
    console.warn('Erro ao buscar portais do banco, usando JSON:', error);
    const json = lerJsonFallback();
    return json.filter(p => p.ativo);
  }
}

export async function getPortaisAsync(): Promise<PortalConfig[]> {
  if (!migrationDone) {
    migrationDone = true;
    try {
      await migrarJsonParaBanco();
    } catch (e) {
      console.warn('Migração inicial ignorada:', e);
    }
  }

  try {
    const portais = await service.listar();
    portaisCache = portais as unknown as PortalConfig[];
    cacheTimestamp = Date.now();
    return portais as unknown as PortalConfig[];
  } catch (error) {
    console.warn('Erro ao buscar portais do banco:', error);
    return lerJsonFallback();
  }
}

export async function getPortaisAtivos(): Promise<PortalConfig[]> {
  try {
    return await service.listarAtivos() as unknown as PortalConfig[];
  } catch (error) {
    console.warn('Erro ao buscar portais ativos do banco:', error);
    const json = lerJsonFallback();
    return json.filter(p => p.ativo);
  }
}

export async function getPortal(id: string): Promise<PortalConfig | null> {
  try {
    return await service.buscarPorId(id) as unknown as PortalConfig | null;
  } catch (error) {
    console.warn(`Erro ao buscar portal ${id} do banco:`, error);
    const json = lerJsonFallback();
    return json.find(p => p.id === id) || null;
  }
}

export async function criarPortal(data: PortalDTO): Promise<PortalConfig> {
  const portal = await service.criar(data);
  invalidarCache();
  return portal as unknown as PortalConfig;
}

export async function atualizarPortal(id: string, data: Partial<PortalDTO>): Promise<PortalConfig> {
  const portal = await service.atualizar(id, data);
  invalidarCache();
  return portal as unknown as PortalConfig;
}

export async function togglePortal(id: string): Promise<PortalConfig> {
  const portal = await service.toggleAtivo(id);
  invalidarCache();
  return portal as unknown as PortalConfig;
}

export async function removerPortal(id: string): Promise<void> {
  try {
    await service.deletar(id);
    invalidarCache();
    console.log(`Portal [${id}] removido com sucesso.`);
  } catch (error: any) {
    if (error.message?.includes('não encontrado')) {
      console.warn(`Portal [${id}] não encontrado no banco.`);
    } else {
      throw error;
    }
  }
}

export async function atualizarUltimoScan(id: string): Promise<void> {
  await service.atualizarUltimoScan(id);
}

function invalidarCache(): void {
  portaisCache = null;
  cacheTimestamp = 0;
}

export function invalidateCache(): void {
  invalidarCache();
}

export async function migrarJsonParaBanco(): Promise<number> {
  try {
    const portaisExistentes = await service.listar();
    if (portaisExistentes.length > 0) {
      console.log('Banco já possui portais, migração ignorada.');
      return 0;
    }

    const portaisJson = lerJsonFallback();
    if (portaisJson.length === 0) {
      console.log('Nenhum portal no JSON para migrar.');
      return 0;
    }

    for (const portal of portaisJson) {
      await service.criar({
        id: portal.id,
        nome: portal.nome,
        urlBusca: portal.urlBusca,
        urlsFallback: portal.urlsFallback,
        tipo: portal.tipo,
        categoria: portal.categoria,
        ativo: portal.ativo,
        scraperModule: portal.scraperModule,
        intervaloMinutos: portal.intervaloMinutos,
        credEmail: portal.credEmail,
      });
    }

    console.log(`${portaisJson.length} portais migrados do JSON para o banco.`);
    invalidarCache();
    return portaisJson.length;
  } catch (error) {
    console.error('Erro na migração de portais:', error);
    return 0;
  }
}