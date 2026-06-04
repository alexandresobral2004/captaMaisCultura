import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const BASE_PATH = path.join(process.cwd(), 'data', 'downloads');

export class FileService {
  async salvarPDF(buffer: Buffer, editalId: string, originalName: string): Promise<string> {
    // Gerar nome unico
    const ext = path.extname(originalName) || '.pdf';
    const fileName = `edital-${editalId}${ext}`;
    const filePath = path.join(BASE_PATH, fileName);

    // Garantir que o diretorio existe
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    // Salvar arquivo
    await fs.writeFile(filePath, buffer);

    // Retornar caminho relativo
    return `downloads/${fileName}`;
  }

  async salvarPDFFromUrl(url: string, editalId: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Erro ao baixar PDF: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return this.salvarPDF(buffer, editalId, `edital-${editalId}.pdf`);
  }

  async deletarArquivo(relativePath: string): Promise<void> {
    const fullPath = path.join(process.cwd(), 'data', relativePath);

    try {
      await fs.unlink(fullPath);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error(`Erro ao deletar arquivo: ${error.message}`);
      }
    }

    // Tentar deletar arquivo de conteudo tambem
    const txtPath = fullPath.replace('.pdf', '-conteudo.txt');
    try {
      await fs.unlink(txtPath);
    } catch {
      // Ignorar se nao existe
    }
  }

  async arquivoExiste(relativePath: string): Promise<boolean> {
    const fullPath = path.join(process.cwd(), 'data', relativePath);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async lerArquivo(relativePath: string): Promise<Buffer> {
    const fullPath = path.join(process.cwd(), 'data', relativePath);
    return fs.readFile(fullPath);
  }

  async calcularHash(filePath: string): Promise<string> {
    const fullPath = path.join(process.cwd(), 'data', filePath);
    const buffer = await fs.readFile(fullPath);
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  async verificarIntegridade(): Promise<{ orfaos: string[]; faltando: string[] }> {
    const { EditalRepository } = await import('../repositories/edital.repository');
    const editalRepo = new EditalRepository();

    const arquivos = await fs.readdir(BASE_PATH);
    const pdfFiles = arquivos.filter((f) => f.endsWith('.pdf'));

    const editaisComPdf = await editalRepo.findWithPdf();

    const orfaos: string[] = [];
    const faltando: string[] = [];

    // Verificar orfoes (arquivo existe mas nao no banco)
    for (const arquivo of pdfFiles) {
      const existe = editaisComPdf.some((e) => e.pdfPath && e.pdfPath.includes(arquivo));
      if (!existe) {
        orfaos.push(arquivo);
      }
    }

    // Verificar faltando (banco tem registro mas arquivo nao existe)
    for (const edital of editaisComPdf) {
      if (edital.pdfPath) {
        const existe = await this.arquivoExiste(edital.pdfPath);
        if (!existe) {
          faltando.push(edital.id);
        }
      }
    }

    return { orfaos, faltando };
  }
}
