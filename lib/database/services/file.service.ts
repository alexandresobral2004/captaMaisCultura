import crypto from 'crypto';
import path from 'path';
import { obterArmazenamento, validarChave } from '../../storage/armazenamento';

const PASTA_DOWNLOADS = 'downloads';

export class FileService {
  /**
   * Chaves são relativas ao armazenamento (ex.: "downloads/edital-123.pdf").
   * O driver (disco local ou bucket) é escolhido em lib/storage/armazenamento.ts.
   */
  async salvarPDF(buffer: Buffer, editalId: string, originalName: string): Promise<string> {
    // Garantir extensão PDF para evitar arquivos maliciosos executáveis
    const ext = path.extname(originalName) || '.pdf';
    if (ext.toLowerCase() !== '.pdf') {
      throw new Error('Apenas arquivos PDF são permitidos.');
    }

    const chave = `${PASTA_DOWNLOADS}/edital-${editalId}${ext}`;
    await obterArmazenamento().salvar(chave, buffer);
    return chave;
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

  async deletarArquivo(chave: string): Promise<void> {
    // Validação fora do try: traversal deve falhar, não ser engolido como "arquivo não encontrado"
    validarChave(chave);
    const armazenamento = obterArmazenamento();
    try {
      await armazenamento.remover(chave);
    } catch (error: any) {
      console.error(`Erro ao deletar arquivo: ${error.message}`);
    }

    // Tentar deletar arquivo de conteudo tambem
    try {
      await armazenamento.remover(chave.replace('.pdf', '-conteudo.txt'));
    } catch {
      // Ignorar se nao existe
    }
  }

  async arquivoExiste(chave: string): Promise<boolean> {
    try {
      return await obterArmazenamento().existe(chave);
    } catch {
      return false;
    }
  }

  async lerArquivo(chave: string): Promise<Buffer> {
    return obterArmazenamento().ler(chave);
  }

  async calcularHash(chave: string): Promise<string> {
    const buffer = await obterArmazenamento().ler(chave);
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  async verificarIntegridade(): Promise<{ orfaos: string[]; faltando: string[] }> {
    const { EditalRepository } = await import('../repositories/edital.repository');
    const editalRepo = new EditalRepository();

    const armazenados = await obterArmazenamento().listar(`${PASTA_DOWNLOADS}/`);
    const pdfFiles = armazenados.filter((k) => k.endsWith('.pdf'));

    const editaisComPdf = await editalRepo.findWithPdf();

    const orfaos: string[] = [];
    const faltando: string[] = [];

    // Verificar orfoes (arquivo existe mas nao no banco)
    for (const chave of pdfFiles) {
      const nome = chave.split('/').pop()!;
      const existe = editaisComPdf.some((e: any) => e.pdfPath && e.pdfPath.includes(nome));
      if (!existe) {
        orfaos.push(nome);
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
