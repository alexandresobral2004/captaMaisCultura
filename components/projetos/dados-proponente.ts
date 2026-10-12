export interface DadosProponente {
  cnpjCpf: string;
  nomeProponente: string;
  tipoPessoa: string;
  logradouro: string;
  cidade: string;
  uf: string;
  cep: string;
  telefones: Array<{ tipo: string; uf: string; ddd: string; numero: string; divulgar: boolean }>;
  emails: Array<{ tipo: string; email: string }>;
  natureza: string;
  esfera: string;
  administracao: string;
  finsLucrativos: string;
  dirigentes: Array<{ cpf: string; nome: string }>;
  historico: string;
  projetosAnteriores: string;
  capacidadeTecnica: string;
}

export const defaultDadosProponente: DadosProponente = {
  cnpjCpf: '',
  nomeProponente: '',
  tipoPessoa: 'fisica',
  logradouro: '',
  cidade: '',
  uf: '',
  cep: '',
  telefones: [],
  emails: [],
  natureza: '',
  esfera: '',
  administracao: '',
  finsLucrativos: '',
  dirigentes: [],
  historico: '',
  projetosAnteriores: '',
  capacidadeTecnica: '',
};
