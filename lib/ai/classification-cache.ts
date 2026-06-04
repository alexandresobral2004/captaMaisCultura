import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DATA_DIR = path.join(process.cwd(), 'data');
const CACHE_FILE = path.join(DATA_DIR, 'classification-cache.json');

export interface ClassificationCacheEntry<T = any> {
  hash: string;
  timestamp: number;
  data: T;
}

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

function ensureCacheFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(CACHE_FILE)) {
    fs.writeFileSync(CACHE_FILE, JSON.stringify({}, null, 2), 'utf-8');
  }
}

function loadCache(): Record<string, ClassificationCacheEntry> {
  ensureCacheFile();

  try {
    const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
    const parsed = JSON.parse(raw || '{}');

    const agora = Date.now();
    const valido: Record<string, ClassificationCacheEntry> = {};

    for (const [key, entry] of Object.entries(parsed)) {
      if (entry && typeof entry === 'object' && typeof (entry as any).timestamp === 'number') {
        if (agora - (entry as any).timestamp <= CACHE_TTL_MS) {
          valido[key] = entry as ClassificationCacheEntry;
        }
      }
    }

    // Se houve expurgo, salvar
    if (Object.keys(valido).length !== Object.keys(parsed).length) {
      fs.writeFileSync(CACHE_FILE, JSON.stringify(valido, null, 2), 'utf-8');
    }

    return valido;
  } catch (error) {
    console.warn('⚠️  Erro ao carregar cache de classificação. Resetando arquivo...', error);
    fs.writeFileSync(CACHE_FILE, JSON.stringify({}, null, 2), 'utf-8');
    return {};
  }
}

function saveCache(cache: Record<string, ClassificationCacheEntry>) {
  ensureCacheFile();
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
}

export function computeContentHash(...parts: (string | undefined | null)[]): string {
  const hash = crypto.createHash('sha256');
  const normalised = parts
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .map((part) => part.trim())
    .join('||');

  hash.update(normalised);
  return hash.digest('hex');
}

export function getCachedClassification<T = any>(hash: string): ClassificationCacheEntry<T> | null {
  if (!hash) return null;
  const cache = loadCache();
  const entry = cache[hash];
  return entry ? (entry as ClassificationCacheEntry<T>) : null;
}

export function setCachedClassification<T = any>(hash: string, data: T): void {
  if (!hash) return;

  const cache = loadCache();
  cache[hash] = {
    hash,
    data,
    timestamp: Date.now()
  };

  saveCache(cache);
}
