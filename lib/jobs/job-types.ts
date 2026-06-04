export enum JobStatus {
  PENDENTE = 'PENDENTE',
  RODANDO = 'RODANDO',
  CONCLUIDO = 'CONCLUIDO',
  ERRO = 'ERRO'
}

export enum JobPhase {
  BUSCA = 'BUSCA',
  DOWNLOAD = 'DOWNLOAD',
  ANALISE = 'ANALISE',
  NOTIFICACAO = 'NOTIFICACAO'
}

export interface JobProgresso {
  totalEncontrados: number;
  totalValidados: number;
  totalDownloads: number;
  totalAnalisados: number;
  totalErros: number;
}

export interface ErroFase {
  fase: JobPhase;
  mensagem: string;
  timestamp: string;
}

export interface JobRecord extends JobProgresso {
  id: string;
  status: JobStatus;
  fase: JobPhase | null;
  erroDetalhes: string | null; // JSON serializado de ErroFase[]
  iniciadoEm: string;
  finalizadoEm: string | null;
  atualizadoEm: string;
}

export interface JobResultado extends JobProgresso {
  jobId: string;
  status: JobStatus;
  erros: ErroFase[];
  iniciadoEm: string;
  finalizadoEm: string | null;
  duracaoMs: number;
}
