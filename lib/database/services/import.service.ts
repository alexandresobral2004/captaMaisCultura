import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { EditalService } from './edital.service';
import { CreateEditalDTO } from '../repositories/edital.repository';

const DOWNLOADS_DIR = path.join(process.cwd(), 'data', 'downloads');

export class ImportService {
  private editalService: EditalService;

  constructor() {
    this.editalService = new EditalService();
  }

  async importarPastaDownloads(): Promise<{
    carregados: number;
    jaExistentes: number;
    total: number;
    erros: string[];
  }> {
    const files = (await fs.readdir(DOWNLOADS_DIR)).filter((f) => f.endsWith('.pdf'));

    let carregados = 0;
    let jaExistentes = 0;
    const erros: string[] = [];

    for (const file of files) {
      const info = this.extrairInfoDoNome(file);
      if (!info) continue;

      const id = `${info.source}-${info.id}`;

      // Verificar se ja existe
      const existente = await this.editalService.buscarPorId(id);
      if (existente) {
        jaExistentes++;
        continue;
      }

      try {
        // Buscar conteudo se existir
        let conteudo = '';
        const conteudoFile = path.join(DOWNLOADS_DIR, file.replace('.pdf', '-conteudo.txt'));
        try {
          conteudo = await fs.readFile(conteudoFile, 'utf-8');
        } catch {
          // Arquivo de conteudo nao existe
        }

        const editalData: CreateEditalDTO = {
          id,
          titulo: `Edital ${file.replace('.pdf', '').replace('edital-', '')}`,
          orgao: info.source.toUpperCase(),
          valor: 'A definir',
          dataLimite: new Date().toISOString().split('T')[0],
          status: 'Aberto',
          link: `file://${path.join(DOWNLOADS_DIR, file)}`,
          descricao: conteudo.substring(0, 500) || `Edital ${file.replace('.pdf', '')}`,
          statusAnalise: 'pdf_baixado',
          pdfPath: `downloads/${file}`,
          fonteConteudo: 'pdf_link',
          conteudoCompleto: conteudo || undefined,
        };

        await this.editalService.criar(editalData);
        carregados++;
      } catch (error: any) {
        erros.push(`${file}: ${error.message}`);
      }
    }

    return {
      carregados,
      jaExistentes,
      total: files.length,
      erros,
    };
  }

  async importarEditalPdf(filePath: string, editalId: string) {
    const buffer = await fs.readFile(filePath);
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');

    const pdfPath = `downloads/edital-${editalId}.pdf`;
    const fullPath = path.join(process.cwd(), 'data', pdfPath);

    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buffer);

    return { pdfPath, hash, tamanho: buffer.length };
  }

  async deletarEditalESubstituir(id: string, novoPdfPath: string) {
    const edital = await this.editalService.buscarPorId(id);

    if (edital?.pdfPath) {
      const fullPath = path.join(process.cwd(), 'data', edital.pdfPath);
      try {
        await fs.unlink(fullPath);
      } catch {
        // Ignorar se nao existe
      }
    }

    await this.editalService.atualizar(id, { pdfPath: novoPdfPath });
  }

  private extrairInfoDoNome(filename: string) {
    const match = filename.match(/edital-([^-]+)-(.+)\.pdf$/);
    if (!match) return null;

    return {
      source: match[1],
      id: match[2],
      filename,
    };
  }
}
