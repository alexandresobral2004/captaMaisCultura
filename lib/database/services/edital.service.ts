import { EditalRepository, CreateEditalDTO, ListEditalQuery } from '../repositories/edital.repository';
import { AnaliseRepository, CreateAnaliseDTO } from '../repositories/analise.repository';
import { PalavraChaveRepository } from '../repositories/palavra-chave.repository';
import { SearchRepository, SearchQuery } from '../repositories/search.repository';
import { FileService } from './file.service';

/** Prazo (AAAA-MM-DD ou DD/MM/AAAA) anterior a hoje; prazo ausente ou "a confirmar" não conta como vencido. */
export function prazoVencido(dataLimite?: string | null, hoje = new Date()): boolean {
  if (!dataLimite) return false;
  const br = dataLimite.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  const iso = br ? `${br[3]}-${br[2]}-${br[1]}` : dataLimite.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  return iso < hoje.toLocaleDateString('sv-SE');
}

export class EditalService {
  private editalRepo: EditalRepository;
  private analiseRepo: AnaliseRepository;
  private palavraChaveRepo: PalavraChaveRepository;
  private searchRepo: SearchRepository;
  private fileService: FileService;

  constructor() {
    this.editalRepo = new EditalRepository();
    this.analiseRepo = new AnaliseRepository();
    this.palavraChaveRepo = new PalavraChaveRepository();
    this.searchRepo = new SearchRepository();
    this.fileService = new FileService();
  }

  async listar(query: ListEditalQuery) {
    if (query.search) {
      return this.searchRepo.searchFullText({
        search: query.search,
        page: query.page,
        limit: query.limit,
        status: query.status,
        orgao: query.orgao,
        tecnologia: query.tecnologia,
        scoreMin: query.scoreMin,
      });
    }

    return this.editalRepo.findAllNotDeleted(query);
  }

  async buscarPorId(id: string) {
    const edital = await this.editalRepo.findByIdNotDeleted(id);
    if (!edital) return null;

    // Buscar analise separadamente
    const analise = await this.analiseRepo.findByEditalId(id);

    return {
      ...edital,
      analiseIA: analise,
    };
  }

  async criar(data: CreateEditalDTO) {
    // Verificar se ID ja existe
    const existente = await this.editalRepo.findById(data.id);
    if (existente) {
      throw new Error(`Edital com ID ${data.id} ja existe`);
    }

    const edital = await this.editalRepo.create(data);

    // Salvar palavras-chave se fornecidas
    if (data.tecnologiaFoco) {
      const palavras = data.tecnologiaFoco.split(',').map((p) => p.trim());
      await this.palavraChaveRepo.createOrUpdate(data.id, palavras);
    }

    return edital;
  }

  async atualizar(id: string, data: Partial<CreateEditalDTO>) {
    const existente = await this.editalRepo.findByIdNotDeleted(id);
    if (!existente) {
      throw new Error(`Edital ${id} nao encontrado`);
    }

    return this.editalRepo.update(id, data);
  }

  /**
   * Exclui o edital (soft-delete). Se o prazo já venceu, ele fica bloqueado e as buscas não o baixam
   * de novo; os demais (prazo em aberto, "a confirmar" ou sem data) podem voltar se reaparecerem num portal.
   */
  async deletar(id: string) {
    const edital = await this.editalRepo.findByIdNotDeleted(id);
    if (!edital) {
      throw new Error(`Edital ${id} nao encontrado`);
    }

    // 1. Deletar arquivo fisico se existir
    if (edital.pdfPath) {
      await this.fileService.deletarArquivo(edital.pdfPath);
    }

    // 2. Deletar analise e palavras-chave (dados derivados - hard delete)
    await Promise.all([
      this.analiseRepo.delete(id),
      this.palavraChaveRepo.delete(id),
    ]);

    // 3. Soft-delete do edital (marca como deleted, não remove do banco)
    // Vencido é bloqueado: não há por que baixá-lo de novo
    const bloqueado = prazoVencido(edital.dataLimite);
    await this.editalRepo.softDelete(id, bloqueado);

    return { ...edital, deletedAt: new Date().toISOString(), bloqueado };
  }

  /**
   * Exclui vários editais de uma vez, cada um pelo mesmo caminho de `deletar`.
   * Uma falha isolada não interrompe as demais.
   */
  async deletarVarios(ids: string[]): Promise<{ excluidos: string[]; falhas: { id: string; erro: string }[] }> {
    const excluidos: string[] = [];
    const falhas: { id: string; erro: string }[] = [];
    for (const id of Array.from(new Set(ids))) {
      try {
        await this.deletar(id);
        excluidos.push(id);
      } catch (erro) {
        falhas.push({ id, erro: (erro as Error).message });
      }
    }
    return { excluidos, falhas };
  }

  async buscarPorIdComPdf(id: string) {
    const edital = await this.editalRepo.findById(id);
    if (!edital) return null;

    // Não expõe caminho do disco: o PDF é acessado pela chave (pdfPath) via FileService
    return { ...edital };
  }

  async listarEditaisComPdf() {
    return this.editalRepo.findWithPdf();
  }

  async contarTotal() {
    return this.editalRepo.count();
  }

  async contarPorStatus() {
    return this.editalRepo.countByStatus();
  }

  // Analise IA
  async salvarAnalise(data: CreateAnaliseDTO) {
    return this.analiseRepo.createOrUpdate(data);
  }

  async buscarAnalise(editalId: string) {
    return this.analiseRepo.findByEditalId(editalId);
  }

  // Busca e filtros
  async buscarFullText(query: SearchQuery) {
    return this.searchRepo.searchFullText(query);
  }

  async obterFiltrosDisponiveis() {
    return this.searchRepo.getFiltersDisponiveis();
  }

  async obterEstatisticas() {
    return this.searchRepo.getStats();
  }
}
