export interface Edital {
  id: string;
  titulo: string;
  orgao: string;
  valor?: string;
  valorMin?: number;
  valorMax?: number;
  dataPublicacao?: string;
  dataLimite: string;
  dataResultado?: string;
  status: 'Aberto' | 'Prorrogado' | 'Em Analise' | 'Fechado';
  statusAnalise?: 'pendente' | 'pdf_baixado' | 'analisado' | 'sem_pdf' | 'descartado' | 'erro';
  modalidade?: string;
  abrangencia?: string;
  tipoProponente?: string[];
  areasTematicas?: string[];
  tipoEdital?: 'chamada_publica' | 'evento_cientifico' | 'outro';
  descricao?: string;
  link: string;
  pdfUrl?: string;
  pdfPath?: string;
  conteudoCompleto?: string;
  fonteConteudo?: string;
  arquivosAnexos?: any[];
  tecnologiaFoco?: string;
  tipoFerramenta?: string;
  scoreRelevancia?: number;
  scoreConfiancaIa?: number;
  validadoPorIa?: boolean;
  dataValidacaoIa?: string;
  criadoEm?: string;
  atualizadoEm?: string;
  analiseIA?: AnaliseIA;
  palavrasChave?: string[];
}

export interface AnaliseIA {
  id?: number;
  editalId?: string;
  resumo?: string;
  objetivo?: string;
  elegibilidade?: string;
  contatoEdital?: string;
  scoreAdequacao?: number;
  requisitos?: string[];
  itensFinanciaveis?: string[];
  documentosNecessarios?: string[];
  criteriosAvaliacao?: string[];
  pontosFracos?: string[];
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  meta?: {
    timestamp: string;
    version: string;
  };
}

export interface FilterParams {
  page?: number;
  limit?: number;
  status?: string;
  orgao?: string;
  tecnologia?: string;
  scoreMin?: number;
  scoreMax?: number;
  dataInicio?: string;
  dataFim?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class EditalAPIClient {
  private baseUrl = '/api/v1';

  async listarEditais(filters?: FilterParams): Promise<ApiResponse<Edital[]>> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }

    const response = await fetch(`${this.baseUrl}/editais?${params}`);
    if (!response.ok) {
      throw new Error('Erro ao buscar editais');
    }
    return response.json();
  }

  async buscarEdital(id: string): Promise<Edital> {
    const response = await fetch(`${this.baseUrl}/editais/${id}`);
    const data = (await response.json()) as ApiResponse<Edital>;

    if (!data.success) {
      throw new Error(data.error?.message || 'Erro ao buscar edital');
    }

    return data.data!;
  }

  async criarEdital(edital: Partial<Edital>): Promise<Edital> {
    const response = await fetch(`${this.baseUrl}/editais`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(edital),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Erro ao criar edital');
    }

    const data = (await response.json()) as ApiResponse<Edital>;
    return data.data!;
  }

  async atualizarEdital(id: string, edital: Partial<Edital>): Promise<Edital> {
    const response = await fetch(`${this.baseUrl}/editais/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(edital),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Erro ao atualizar edital');
    }

    const data = (await response.json()) as ApiResponse<Edital>;
    return data.data!;
  }

  async deletarEdital(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/editais/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Erro ao deletar edital');
    }
  }

  async atualizarStatus(id: string, status: string): Promise<Edital> {
    const response = await fetch(`${this.baseUrl}/editais/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Erro ao atualizar status');
    }

    const data = (await response.json()) as ApiResponse<Edital>;
    return data.data!;
  }

  async buscarFullText(termo: string, filtros?: FilterParams): Promise<ApiResponse<Edital[]>> {
    const params = new URLSearchParams({ search: termo });
    if (filtros) {
      Object.entries(filtros).forEach(([key, value]) => {
        if (value !== undefined && value !== null && key !== 'search') {
          params.append(key, String(value));
        }
      });
    }

    const response = await fetch(`${this.baseUrl}/editais/search?${params}`);
    if (!response.ok) {
      throw new Error('Erro na busca');
    }
    return response.json();
  }

  async obterFiltros(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/editais/filters`);
    const data = (await response.json()) as ApiResponse;
    if (!data.success) {
      throw new Error('Erro ao obter filtros');
    }
    return data.data;
  }

  async obterEstatisticas(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/editais/stats`);
    const data = (await response.json()) as ApiResponse;
    if (!data.success) {
      throw new Error('Erro ao obter estatísticas');
    }
    return data.data;
  }

  // Análise IA
  async buscarAnalise(editalId: string): Promise<AnaliseIA> {
    const response = await fetch(`${this.baseUrl}/editais/${editalId}/analysis`);
    const data = (await response.json()) as ApiResponse<AnaliseIA>;

    if (!data.success) {
      throw new Error(data.error?.message || 'Análise não encontrada');
    }

    return data.data!;
  }

  async salvarAnalise(editalId: string, analise: AnaliseIA): Promise<AnaliseIA> {
    const response = await fetch(`${this.baseUrl}/editais/${editalId}/analysis`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(analise),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Erro ao salvar análise');
    }

    const data = (await response.json()) as ApiResponse<AnaliseIA>;
    return data.data!;
  }

  async dispararAnalise(editalId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/editais/${editalId}/analyze`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Erro ao disparar análise');
    }

    const data = (await response.json()) as ApiResponse;
    return data.data;
  }

  // Arquivos
  async uploadPDF(editalId: string, file: File): Promise<any> {
    const formData = new FormData();
    formData.append('pdf', file);

    const response = await fetch(`${this.baseUrl}/editais/${editalId}/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Erro ao fazer upload');
    }

    const data = (await response.json()) as ApiResponse;
    return data.data;
  }

  async downloadPDF(editalId: string): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/editais/${editalId}/download`);

    if (!response.ok) {
      throw new Error('Erro ao baixar PDF');
    }

    return response.blob();
  }

  async deletarArquivo(editalId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/editais/${editalId}/file`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Erro ao deletar arquivo');
    }
  }

  // Importação
  async importarPasta(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/import/folder`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Erro na importação');
    }

    const data = (await response.json()) as ApiResponse;
    return data.data;
  }

  async statusImportacao(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/import/status`);
    const data = (await response.json()) as ApiResponse;
    if (!data.success) {
      throw new Error('Erro ao obter status');
    }
    return data.data;
  }
}

// Export singleton instance
export const editalAPI = new EditalAPIClient();
