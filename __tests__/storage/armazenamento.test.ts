import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import {
  ArmazenamentoLocal,
  ArmazenamentoS3,
  obterArmazenamento,
  definirArmazenamento,
  validarChave,
} from '../../lib/storage/armazenamento';

describe('ArmazenamentoLocal', () => {
  let raiz: string;
  let armazenamento: ArmazenamentoLocal;

  beforeEach(async () => {
    raiz = await fs.mkdtemp(path.join(os.tmpdir(), 'armazenamento-'));
    armazenamento = new ArmazenamentoLocal(raiz);
  });

  afterEach(async () => {
    await fs.rm(raiz, { recursive: true, force: true });
  });

  it('salva, lê, verifica existência e remove', async () => {
    await armazenamento.salvar('downloads/edital-1.pdf', Buffer.from('conteudo'));

    expect(await armazenamento.existe('downloads/edital-1.pdf')).toBe(true);
    expect((await armazenamento.ler('downloads/edital-1.pdf')).toString()).toBe('conteudo');

    await armazenamento.remover('downloads/edital-1.pdf');
    expect(await armazenamento.existe('downloads/edital-1.pdf')).toBe(false);
  });

  it('remover de chave inexistente não falha', async () => {
    await expect(armazenamento.remover('downloads/nao-existe.pdf')).resolves.toBeUndefined();
  });

  it('lista arquivos de um prefixo e retorna vazio se a pasta não existe', async () => {
    await armazenamento.salvar('downloads/a.pdf', Buffer.from('a'));
    await armazenamento.salvar('downloads/b.pdf', Buffer.from('b'));

    expect((await armazenamento.listar('downloads/')).sort()).toEqual(['downloads/a.pdf', 'downloads/b.pdf']);
    expect(await armazenamento.listar('outra/')).toEqual([]);
  });

  it('rejeita traversal e caminho absoluto', async () => {
    await expect(armazenamento.salvar('../fora.pdf', Buffer.from('x'))).rejects.toThrow('Directory Traversal');
    await expect(armazenamento.ler('/etc/passwd')).rejects.toThrow('inválida');
  });
});

describe('validarChave', () => {
  it('aceita chaves relativas comuns', () => {
    expect(validarChave('downloads/edital-1.pdf')).toBe('downloads/edital-1.pdf');
  });

  it('rejeita pasta irmã com prefixo igual ao da raiz', async () => {
    const raiz = await fs.mkdtemp(path.join(os.tmpdir(), 'armazenamento-'));
    const local = new ArmazenamentoLocal(raiz);
    await expect(local.ler('../' + path.basename(raiz) + '-evil/x.pdf')).rejects.toThrow('Directory Traversal');
    await fs.rm(raiz, { recursive: true, force: true });
  });
});

describe('obterArmazenamento', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    definirArmazenamento(null);
  });

  it('usa disco local por padrão', () => {
    delete process.env.ARMAZENAMENTO_DRIVER;
    definirArmazenamento(null);
    expect(obterArmazenamento()).toBeInstanceOf(ArmazenamentoLocal);
  });

  it('com driver s3 e variáveis faltando, falha com a lista do que falta', () => {
    process.env.ARMAZENAMENTO_DRIVER = 's3';
    delete process.env.ARMAZENAMENTO_BUCKET;
    definirArmazenamento(null);
    expect(() => obterArmazenamento()).toThrow('ARMAZENAMENTO_BUCKET');
  });

  it('com driver s3 e variáveis completas, cria o driver S3', () => {
    process.env.ARMAZENAMENTO_DRIVER = 's3';
    process.env.ARMAZENAMENTO_BUCKET = 'b';
    process.env.ARMAZENAMENTO_ENDPOINT = 'https://example.invalid';
    process.env.ARMAZENAMENTO_REGION = 'auto';
    process.env.ARMAZENAMENTO_ACCESS_KEY_ID = 'k';
    process.env.ARMAZENAMENTO_SECRET_ACCESS_KEY = 's';
    definirArmazenamento(null);
    expect(obterArmazenamento()).toBeInstanceOf(ArmazenamentoS3);
  });
});
