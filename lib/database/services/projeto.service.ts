import { ProjetoRepository, CreateProjetoDTO, ListProjetoQuery } from '../repositories/projeto.repository';
import { AnaliseRepository } from '../repositories/analise.repository';
import { EditalRepository } from '../repositories/edital.repository';

export class ProjetoService {
  private projetoRepo: ProjetoRepository;
  private analiseRepo: AnaliseRepository;
  private editalRepo: EditalRepository;

  constructor() {
    this.projetoRepo = new ProjetoRepository();
    this.analiseRepo = new AnaliseRepository();
    this.editalRepo = new EditalRepository();
  }

  async criar(data: CreateProjetoDTO) {
    // Verificar se edital existe
    const edital = await this.editalRepo.findById(data.editalId);
    if (!edital) {
      throw new Error('Edital nao encontrado');
    }

    return this.projetoRepo.create(data);
  }

  async buscarPorId(id: string) {
    const projeto = await this.projetoRepo.findByIdWithEdital(id);
    if (!projeto) return null;

    const analise = await this.analiseRepo.findByEditalId(projeto.editalId);

    const parseJsonField = (value: any): any => {
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
      return value;
    };

    return {
      ...projeto,
      equipe: parseJsonField(projeto.equipe),
      criteriosAtendidos: parseJsonField(projeto.criteriosAtendidos),
      criteriosPendentes: parseJsonField(projeto.criteriosPendentes),
      edital: {
        ...projeto.edital,
        analiseIA: analise,
      },
    };
  }

  async listar(query: ListProjetoQuery) {
    return this.projetoRepo.findAll(query);
  }

  async atualizar(id: string, data: Partial<CreateProjetoDTO>) {
    const existente = await this.projetoRepo.findById(id);
    if (!existente) {
      throw new Error('Projeto nao encontrado');
    }

    return this.projetoRepo.update(id, data);
  }

  async deletar(id: string) {
    const existente = await this.projetoRepo.findById(id);
    if (!existente) {
      throw new Error('Projeto nao encontrado');
    }

    await this.projetoRepo.delete(id);
    return true;
  }

  async contarTotal(): Promise<number> {
    return this.projetoRepo.count();
  }

  async buscarPorEditalId(editalId: string) {
    return this.projetoRepo.findByEditalId(editalId);
  }
}
