export interface Edital {
  id: string;
  titulo: string;
  orgao: string;
  valor: string;
  dataLimite: string;
  status: string;
  descricao: string;
  link: string;
  codigo?: string;
  criadoEm?: string;
  statusAnalise?: 'pendente' | 'pdf_baixado' | 'analisado' | 'sem_pdf' | 'descartado' | 'erro';
  erroAnalise?: string;
  fonteConteudo?: string;
  analiseIA?: {
    resumo: string;
    objetivo?: string;
    requisitos: string[];
    elegibilidade: string;
    itensFinanciáveis: string[];
    documentosNecessarios?: string[];
    criteriosAvaliacao?: string[];
    pontosFracos?: string[];
    contatoEdital?: string;
    scoreAdequacao?: number;
  };
  areasTematicas?: string[];
  tipoProponente?: string[];
  tipoEdital?: 'chamada_publica' | 'evento_cientifico' | 'outro';
  modalidade?: string;
  abrangencia?: string;
  tecnologiaFoco?: string;
  categoriaArea?: string;
}
