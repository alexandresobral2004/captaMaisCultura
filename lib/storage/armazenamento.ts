import fs from 'fs/promises';
import path from 'path';
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

/**
 * Armazenamento de arquivos (PDFs, conteúdo extraído) desacoplado do disco do processo.
 * Chaves são caminhos relativos com '/' (ex.: "downloads/edital-123.pdf").
 */
export interface Armazenamento {
  salvar(chave: string, conteudo: Buffer): Promise<void>;
  ler(chave: string): Promise<Buffer>;
  existe(chave: string): Promise<boolean>;
  remover(chave: string): Promise<void>;
  listar(prefixo: string): Promise<string[]>;
}

/** Valida a chave: sem caminho absoluto e sem subir de diretório. */
export function validarChave(chave: string): string {
  const normalizada = chave.replace(/\\/g, '/');
  const partes = normalizada.split('/');
  if (!normalizada || normalizada.startsWith('/') || /^[a-zA-Z]:/.test(normalizada)) {
    throw new Error('Chave de armazenamento inválida.');
  }
  if (partes.some((p) => p === '..')) {
    throw new Error('Acesso negado: Tentativa de Directory Traversal detectada.');
  }
  return normalizada;
}

/** Disco local, com a raiz em `base` (padrão: ./data). Usado em desenvolvimento e testes. */
export class ArmazenamentoLocal implements Armazenamento {
  constructor(private readonly base: string = path.join(process.cwd(), 'data')) {}

  private caminho(chave: string): string {
    const relativo = validarChave(chave);
    const absoluto = path.resolve(this.base, relativo);
    if (!absoluto.startsWith(path.resolve(this.base) + path.sep)) {
      throw new Error('Acesso negado: chave fora da raiz de armazenamento.');
    }
    return absoluto;
  }

  async salvar(chave: string, conteudo: Buffer): Promise<void> {
    const destino = this.caminho(chave);
    await fs.mkdir(path.dirname(destino), { recursive: true });
    await fs.writeFile(destino, conteudo);
  }

  async ler(chave: string): Promise<Buffer> {
    return fs.readFile(this.caminho(chave));
  }

  async existe(chave: string): Promise<boolean> {
    try {
      await fs.access(this.caminho(chave));
      return true;
    } catch {
      return false;
    }
  }

  async remover(chave: string): Promise<void> {
    try {
      await fs.unlink(this.caminho(chave));
    } catch (erro: any) {
      if (erro.code !== 'ENOENT') throw erro;
    }
  }

  async listar(prefixo: string): Promise<string[]> {
    const dir = this.caminho(prefixo);
    try {
      const entradas = await fs.readdir(dir);
      return entradas.map((nome) => `${validarChave(prefixo).replace(/\/$/, '')}/${nome}`);
    } catch (erro: any) {
      if (erro.code === 'ENOENT') return [];
      throw erro;
    }
  }
}

export interface ConfigS3 {
  bucket: string;
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/** Bucket S3-compatível (ex.: bucket do Railway). Estilo de caminho para aceitar qualquer endpoint. */
export class ArmazenamentoS3 implements Armazenamento {
  private readonly cliente: S3Client;

  constructor(private readonly config: ConfigS3) {
    this.cliente = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: true,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
  }

  async salvar(chave: string, conteudo: Buffer): Promise<void> {
    await this.cliente.send(new PutObjectCommand({ Bucket: this.config.bucket, Key: validarChave(chave), Body: conteudo }));
  }

  async ler(chave: string): Promise<Buffer> {
    const resp = await this.cliente.send(new GetObjectCommand({ Bucket: this.config.bucket, Key: validarChave(chave) }));
    if (!resp.Body) throw new Error(`Objeto vazio ou inexistente: ${chave}`);
    return Buffer.from(await resp.Body.transformToByteArray());
  }

  async existe(chave: string): Promise<boolean> {
    try {
      await this.cliente.send(new HeadObjectCommand({ Bucket: this.config.bucket, Key: validarChave(chave) }));
      return true;
    } catch (erro: any) {
      if (erro?.name === 'NotFound' || erro?.$metadata?.httpStatusCode === 404) return false;
      throw erro;
    }
  }

  async remover(chave: string): Promise<void> {
    await this.cliente.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: validarChave(chave) }));
  }

  async listar(prefixo: string): Promise<string[]> {
    const resp = await this.cliente.send(new ListObjectsV2Command({ Bucket: this.config.bucket, Prefix: validarChave(prefixo) }));
    return (resp.Contents ?? []).map((o) => o.Key!).filter(Boolean);
  }
}

let instancia: Armazenamento | null = null;

/**
 * Escolhe o driver pela variável ARMAZENAMENTO_DRIVER: "s3" ou "local" (padrão).
 * Com "s3", exige ARMAZENAMENTO_BUCKET, ARMAZENAMENTO_ENDPOINT, ARMAZENAMENTO_REGION,
 * ARMAZENAMENTO_ACCESS_KEY_ID e ARMAZENAMENTO_SECRET_ACCESS_KEY.
 */
export function obterArmazenamento(): Armazenamento {
  if (instancia) return instancia;

  const driver = (process.env.ARMAZENAMENTO_DRIVER || 'local').toLowerCase();
  if (driver === 's3') {
    const faltando = ['BUCKET', 'ENDPOINT', 'REGION', 'ACCESS_KEY_ID', 'SECRET_ACCESS_KEY']
      .filter((nome) => !process.env[`ARMAZENAMENTO_${nome}`]);
    if (faltando.length) {
      throw new Error(`Armazenamento S3 sem variáveis: ${faltando.map((n) => `ARMAZENAMENTO_${n}`).join(', ')}`);
    }
    instancia = new ArmazenamentoS3({
      bucket: process.env.ARMAZENAMENTO_BUCKET!,
      endpoint: process.env.ARMAZENAMENTO_ENDPOINT!,
      region: process.env.ARMAZENAMENTO_REGION!,
      accessKeyId: process.env.ARMAZENAMENTO_ACCESS_KEY_ID!,
      secretAccessKey: process.env.ARMAZENAMENTO_SECRET_ACCESS_KEY!,
    });
  } else {
    if (process.env.RAILWAY_ENVIRONMENT) {
      // No Railway o disco do container some a cada deploy: PDFs gravados aqui se perdem
      console.warn(
        '⚠️ [Armazenamento] Rodando no Railway com ARMAZENAMENTO_DRIVER=local. ' +
          'PDFs ficam no disco efêmero e somem no próximo deploy. Defina ARMAZENAMENTO_DRIVER=s3 e as variáveis ARMAZENAMENTO_*.'
      );
    }
    instancia = new ArmazenamentoLocal();
  }
  return instancia;
}

/** Usado apenas em testes, para trocar o driver. */
export function definirArmazenamento(a: Armazenamento | null): void {
  instancia = a;
}
