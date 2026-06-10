import { TecnologiaFoco, TipoFerramenta } from '../scraper/filtros-ti';
import { EditalRepository, CreateEditalDTO } from '../database/repositories/edital.repository';
import { AnaliseRepository, CreateAnaliseDTO } from '../database/repositories/analise.repository';
import { db } from '../database/db';
import { eq, or, gte, and } from 'drizzle-orm';
import { editais as editaisTable } from '../database/schema';

// ============================================================
// INICIALIZAÇÃO DO DAEMON (DESABILITADA v3.0)
// ============================================================
// ATENÇÃO: Busca automática desabilitada. Usar ./scripts/buscar-editais.sh
// 
// if (typeof window === 'undefined') {
//   const globalAny: any = globalThis;
//   if (!globalAny.__editalWorkerStarted) {
//     globalAny.__editalWorkerStarted = true;
//     console.log('⚙️ Inicializando Daemon de Busca de Editais em Segundo Plano...');
// 
//     try {
//       const { iniciarScheduler } = require('../jobs/scheduler');
//       iniciarScheduler();
//     } catch (erro) {
//       console.warn('⚠️ Erro ao iniciar scheduler:', erro);
//     }
// 
//     setTimeout(() => {
//       runBackgroundWorker();
//     }, 15000);
// 
//     setInterval(() => {
//       runBackgroundWorker();
//     }, 30 * 60 * 1000);
//   }
// }

// ============================================================
// INTERFACE EDITAL (mantida - backward compatibility)
// ============================================================
export interface Edital {
  id: string;
  titulo: string;
  orgao: string;
  codigo?: string;

  valor: string;
  valorMin?: number;
  valorMax?: number;

  dataPublicacao?: string;
  dataAbertura?: string;
  dataLimite: string;
  dataResultado?: string;

  status: 'Aberto' | 'Prorrogado' | 'Em Análise' | 'Fechado';
  modalidade?: string;
  areasTematicas?: string[];
  abrangencia?: string;
  tipoProponente?: string[];

  descricao: string;
  link: string;
  pdfUrl?: string;
  pdfSalvoEm?: string;
  conteudoCompleto?: string;

  arquivosAnexos?: {
    descricao: string;
    url: string;
    tipo: string;
  }[];

  fonteConteudo?: 'pdf_s3' | 'pdf_link' | 'html_link' | 'descricao_api' | 'mock' | 'sem_pdf' | 'pdf_upload';

  tecnologiaFoco?: TecnologiaFoco;
  tipoFerramenta?: TipoFerramenta;
  scoreRelevancia?: number;
  scoreConfiancaIA?: number;
  validadoPorIA?: boolean;
  palavrasChaveEncontradas?: string[];
  motivoRejeicao?: string;
  foraDoEscopo?: boolean | null;
  dataValidacaoIA?: string;
  scorePontuacao?: number;
  nivelPontuacao?: 'baixo' | 'medio' | 'alto';
  motivosPontuacao?: string[];
  modoAnaliseIA?: 'ignorar' | 'simplificado' | 'completo';
  hashPontuacao?: string;
  cacheClassificacaoUsado?: boolean;

  analiseIA?: {
    resumo: string;
    objetivo: string;
    requisitos: string[];
    elegibilidade: string;
    itensFinanciáveis: string[];
    documentosNecessarios: string[];
    criteriosAvaliacao: string[];
    contatoEdital?: string;
    pontosFracos?: string[];
    scoreAdequacao?: number;
    secoesRequeridas?: string[];
  };

  statusAnalise?: 'pendente' | 'pdf_baixado' | 'analisado' | 'sem_pdf' | 'descartado' | 'erro' | 'duvida';
  erroAnalise?: string;

  confiancaClassificacao?: number;
  confiancaPorCampo?: { [campo: string]: number };

  statusRevisao?: 'pendente' | 'aprovado' | 'rejeitado';
  ultimaAnalise?: Date;
  validadoManualmente?: boolean;
  aprovedoPor?: string;
  dataAprovacao?: Date;
  errosValidacao?: Array<{
    campo: string;
    tipo: 'ERRO' | 'AVISO';
    mensagem: string;
  }>;

  tipoEdital?: 'chamada_publica' | 'evento_cientifico' | 'outro';

  scoreValidacaoKeywords?: number;
  contadorPalavrasChave?: {
    mandatoryTerms?: number;
    likelyTerms?: number;
    academicTerms?: number;
    fundingTerms?: number;
    eligibilityTerms?: number;
    submissionTerms?: number;
    timelineTerms?: number;
    evaluationTerms?: number;
    negativeTerms?: number;
  };
  densidadeKeywords?: number;
  oportunidadesDetectadas?: string[];
  validacaoConteudoResultado?: 'aprovado' | 'rejeitado' | 'em_analise' | 'nao_validado';
  motiovoRejeicaoKeywords?: string;
  avisoValidacaoKeywords?: string[];

  dadosExtraidos?: {
    resumo?: string;
    objetivo?: string;
    datas?: {
      publicacao?: string;
      abertura?: string;
      encerramento?: string;
      resultado?: string;
    };
    financeiro?: {
      valorTotal?: string;
      valorMin?: number;
      valorMax?: number;
      moeda?: string;
      tipo?: string;
    };
    elegibilidade?: {
      tiposProponentes?: string[];
      requisitosMinimos?: string[];
      restricoes?: string[];
      abrangencia?: string;
    };
    cronograma?: string;
    confiancaExtracao?: number;
    metodosUsados?: string[];
  };

  criadoEm: string;
  atualizadoEm?: string;
  deletedAt?: string | null;
  categoriaArea?: string;
}

// ============================================================
// UTILIDADES
// ============================================================
export function parseDateString(dateStr: string): Date | null {
  if (!dateStr) return null;

  if (dateStr.includes('-')) {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  }

  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    return new Date(year, month, day, 23, 59, 59);
  }
  return null;
}

// ============================================================
// MAPEAMENTO: DB → Edital
// ============================================================
function dbToEdital(row: any, analise?: any): Edital {
  const edital: Edital = {
    id: row.id,
    titulo: row.titulo,
    orgao: row.orgao,
    codigo: row.codigo ?? undefined,
    valor: row.valor || '',
    valorMin: row.valorMin ?? row.valor_min ?? undefined,
    valorMax: row.valorMax ?? row.valor_max ?? undefined,
    dataPublicacao: row.dataPublicacao ?? row.data_publicacao ?? undefined,
    dataAbertura: row.dataAbertura ?? row.data_abertura ?? undefined,
    dataLimite: row.dataLimite ?? row.data_limite ?? '',
    dataResultado: row.dataResultado ?? row.data_resultado ?? undefined,
    status: (row.status || 'Aberto') as Edital['status'],
    modalidade: row.modalidade ?? undefined,
    areasTematicas: safeJsonParse(row.areasTematicas ?? row.areas_tematicas),
    abrangencia: row.abrangencia ?? undefined,
    tipoProponente: safeJsonParse(row.tipoProponente ?? row.tipo_proponente),
    descricao: row.descricao || '',
    link: row.link,
    pdfUrl: row.pdfUrl ?? row.pdf_url ?? undefined,
    pdfSalvoEm: row.pdfPath ?? row.pdf_path ?? undefined,
    conteudoCompleto: row.conteudoCompleto ?? row.conteudo_completo ?? undefined,
    arquivosAnexos: safeJsonParse(row.arquivosAnexos ?? row.arquivos_anexos),
    fonteConteudo: row.fonteConteudo ?? row.fonte_conteudo ?? undefined,
    tecnologiaFoco: row.tecnologiaFoco ?? row.tecnologia_foco ?? undefined,
    tipoFerramenta: row.tipoFerramenta ?? row.tipo_ferramenta ?? undefined,
    scoreRelevancia: row.scoreRelevancia ?? row.score_relevancia ?? undefined,
    scoreConfiancaIA: row.scoreConfiancaIa ?? row.score_confianca_ia ?? undefined,
    validadoPorIA: row.validadoPorIa ?? row.validado_por_ia ?? undefined,
    motivoRejeicao: row.motivoRejeicao ?? row.motivo_rejeicao ?? undefined,
    foraDoEscopo: row.foraDoEscopo ?? row.fora_do_escopo ?? undefined,
    dataValidacaoIA: row.dataValidacaoIa ?? row.data_validacao_ia ?? undefined,
    scorePontuacao: row.scorePontuacao ?? row.score_pontuacao ?? undefined,
    nivelPontuacao: row.nivelPontuacao ?? row.nivel_pontuacao ?? undefined,
    motivosPontuacao: safeJsonParse(row.motivosPontuacao ?? row.motivos_pontuacao),
    modoAnaliseIA: row.modoAnaliseIa ?? row.modo_analise_ia ?? undefined,
    hashPontuacao: row.hashPontuacao ?? row.hash_pontuacao ?? undefined,
    cacheClassificacaoUsado: row.cacheClassificacaoUsado ?? row.cache_classificacao_usado ?? undefined,
    confiancaPorCampo: safeJsonParse(row.confiancaPorCampo ?? row.confianca_por_campo) ?? undefined,
    statusAnalise: row.statusAnalise ?? row.status_analise ?? undefined,
    erroAnalise: row.erroAnalise ?? row.erro_analise ?? undefined,
    tipoEdital: row.tipoEdital ?? row.tipo_edital ?? undefined,
    scoreValidacaoKeywords: row.scoreValidacaoKeywords ?? row.score_validacao_keywords ?? undefined,
    contadorPalavrasChave: row.contadorPalavrasChave ?? row.contador_palavras_chave ?? undefined,
    densidadeKeywords: row.densidadeKeywords ?? row.densidade_keywords ?? undefined,
    oportunidadesDetectadas: row.oportunidadesDetectadas ?? row.oportunidades_detectadas ?? undefined,
    validacaoConteudoResultado: row.validacaoConteudoResultado ?? row.validacao_conteudo_resultado ?? undefined,
    motiovoRejeicaoKeywords: row.motiovoRejeicaoKeywords ?? row.motiovo_rejeicao_keywords ?? undefined,
    avisoValidacaoKeywords: row.avisoValidacaoKeywords ?? row.aviso_validacao_keywords ?? undefined,
    dadosExtraidos: row.dadosExtraidos ?? row.dados_extraidos ?? undefined,
    criadoEm: row.criadoEm || row.criado_em || new Date().toISOString(),
    atualizadoEm: row.atualizadoEm ?? row.atualizado_em ?? undefined,
    deletedAt: row.deletedAt ?? row.deleted_at ?? undefined,
    categoriaArea: row.categoriaArea ?? row.categoria_area ?? 'Cultura',
  };

  // Mapear analiseIA do banco normalizado
  if (analise) {
    edital.analiseIA = {
      resumo: analise.resumo || '',
      objetivo: analise.objetivo || '',
      requisitos: analise.requisitos || [],
      elegibilidade: analise.elegibilidade || '',
      itensFinanciáveis: analise.itensFinanciaveis || [],
      documentosNecessarios: analise.documentosNecessarios || [],
      criteriosAvaliacao: analise.criteriosAvaliacao || [],
      contatoEdital: analise.contatoEdital ?? undefined,
      pontosFracos: analise.pontosFracos || [],
      scoreAdequacao: analise.scoreAdequacao ?? undefined,
      secoesRequeridas: analise.secoesRequeridas || [],
    };
  }

  return edital;
}

function safeJsonParse(value: any): any {
  if (!value) return undefined;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  return value;
}

// ============================================================
// MAPEAMENTO: Edital → DB
// ============================================================
function editalToDb(edital: Partial<Edital>): CreateEditalDTO {
  return {
    id: edital.id!,
    titulo: edital.titulo || '',
    orgao: edital.orgao || '',
    valor: edital.valor,
    valorMin: edital.valorMin,
    valorMax: edital.valorMax,
    dataPublicacao: edital.dataPublicacao,
    dataAbertura: edital.dataAbertura,
    dataLimite: edital.dataLimite || '',
    dataResultado: edital.dataResultado,
    status: edital.status,
    statusAnalise: edital.statusAnalise,
    erroAnalise: edital.erroAnalise,
    modalidade: edital.modalidade,
    abrangencia: edital.abrangencia,
    tipoProponente: edital.tipoProponente,
    areasTematicas: edital.areasTematicas,
    tipoEdital: edital.tipoEdital,
    descricao: edital.descricao,
    link: edital.link || '',
    pdfUrl: edital.pdfUrl,
    pdfPath: edital.pdfSalvoEm,
    conteudoCompleto: edital.conteudoCompleto,
    fonteConteudo: edital.fonteConteudo,
    arquivosAnexos: edital.arquivosAnexos,
    tecnologiaFoco: edital.tecnologiaFoco,
    tipoFerramenta: edital.tipoFerramenta,
    scoreRelevancia: edital.scoreRelevancia,
    scoreConfiancaIa: edital.scoreConfiancaIA,
    validadoPorIa: edital.validadoPorIA,
    motivoRejeicao: edital.motivoRejeicao,
    foraDoEscopo: edital.foraDoEscopo,
    dataValidacaoIa: edital.dataValidacaoIA,
    scorePontuacao: edital.scorePontuacao,
    nivelPontuacao: edital.nivelPontuacao,
    motivosPontuacao: edital.motivosPontuacao,
    modoAnaliseIa: edital.modoAnaliseIA,
    hashPontuacao: edital.hashPontuacao,
    cacheClassificacaoUsado: edital.cacheClassificacaoUsado,
    confiancaPorCampo: edital.confiancaPorCampo,
    categoriaArea: edital.categoriaArea,
  };
}

// ============================================================
// FUNÇÕES PÚBLICAS (agora async)
// ============================================================
const repo = new EditalRepository();
const analiseRepo = new AnaliseRepository();

export async function getAllEditais(incluirFechados = false, categoriaArea?: string): Promise<Edital[]> {
  try {
    let query = `SELECT * FROM editais`;
    const conditions: string[] = [];

    // Sempre ignorar os editais deletados logicamente
    conditions.push('deleted_at IS NULL');

    if (!incluirFechados) {
      const agora = new Date().toISOString();
      conditions.push(`(data_limite IS NULL OR data_limite >= '${agora}')`);
    }

    if (categoriaArea) {
      conditions.push(`categoria_area = '${categoriaArea}'`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY criado_em DESC`;

    const rows = db.all(query) as any[];

    // Buscar analises em paralelo
    const editalIds = rows.map(r => r.id);
    const analises = await Promise.all(
      editalIds.map(id => analiseRepo.findByEditalId(id))
    );

    return rows.map((row, i) => dbToEdital(row, analises[i]));
  } catch (erro) {
    console.error('❌ Erro ao buscar editais no banco:', erro);
    return [];
  }
}

export async function saveEdital(edital: Partial<Edital> & { id: string }): Promise<Edital> {
  try {
    const dbData = editalToDb(edital);

    // Buscar existente no banco (incluindo deletados)
    let existente = await repo.findById(edital.id);

    // Se não encontrou por ID, tentar por link (para scrapers que geram ID por hash do link)
    if (!existente && dbData.link) {
      existente = await repo.findByLink(dbData.link);
    }

    // Se o edital já foi excluído/inativo, ignoramos e não fazemos nada
    if (existente && existente.deletedAt !== null) {
      console.log(`ℹ️ Edital ${edital.id} já está excluído/inativo no banco de dados. Ignorando atualização/inserção.`);
      const analise = await analiseRepo.findByEditalId(existente.id);
      return dbToEdital(existente, analise);
    }

    let resultado: any;

    if (existente) {
      // Merge: preservar campos não enviados
      const merged: CreateEditalDTO = {
        ...dbData,
        titulo: dbData.titulo || existente.titulo,
        orgao: dbData.orgao || existente.orgao,
        link: dbData.link || existente.link,
        dataLimite: dbData.dataLimite || existente.dataLimite,
        descricao: dbData.descricao || existente.descricao || undefined,
        valor: dbData.valor ?? existente.valor ?? undefined,
        statusAnalise: dbData.statusAnalise || existente.statusAnalise || undefined,
      };
      resultado = await repo.update(existente.id, merged);
    } else {
      resultado = await repo.create(dbData);
    }

    // Salvar analiseIA se fornecida
    if (edital.analiseIA) {
      await analiseRepo.createOrUpdate({
        editalId: edital.id,
        resumo: edital.analiseIA.resumo,
        objetivo: edital.analiseIA.objetivo,
        elegibilidade: edital.analiseIA.elegibilidade,
        contatoEdital: edital.analiseIA.contatoEdital,
        scoreAdequacao: edital.analiseIA.scoreAdequacao,
        requisitos: edital.analiseIA.requisitos,
        itensFinanciaveis: edital.analiseIA.itensFinanciáveis,
        documentos: edital.analiseIA.documentosNecessarios,
        criterios: edital.analiseIA.criteriosAvaliacao,
        pontosFracos: edital.analiseIA.pontosFracos,
        secoesRequeridas: edital.analiseIA.secoesRequeridas,
      });
    }

    // Buscar analise para retornar edital completo
    const analise = await analiseRepo.findByEditalId(edital.id);
    return dbToEdital(resultado, analise);
  } catch (erro) {
    console.error('❌ Erro ao salvar edital no banco:', erro);
    throw new Error(`Falha ao salvar edital ${edital.id}: ${(erro as Error).message}`);
  }
}

export async function salvarValidacaoKeywords(
  editalId: string,
  validacaoResult: any,
  dadosExtraidos?: any
): Promise<Edital | null> {
  try {
    const existente = await repo.findById(editalId);
    if (!existente) {
      console.warn(`⚠️ Edital ${editalId} não encontrado para salvar validação`);
      return null;
    }

    await repo.update(editalId, {
      scoreValidacaoKeywords: validacaoResult.scoreTotal,
      densidadeKeywords: validacaoResult.densidadeKeywords,
      oportunidadesDetectadas: validacaoResult.oportunidadesDetectadas,
    });

    const edital = await repo.findById(editalId);
    return dbToEdital(edital);
  } catch (erro) {
    console.error(`❌ Erro ao salvar validação keywords para ${editalId}:`, erro);
    return null;
  }
}

export async function deleteEdital(id: string): Promise<boolean> {
  try {
    const existente = await repo.findById(id);
    if (!existente) return false;

    const { EditalService } = await import('../database/services/edital.service');
    const service = new EditalService();
    await service.deletar(id);
    return true;
  } catch (erro) {
    console.error(`❌ Erro ao deletar edital ${id}:`, erro);
    return false;
  }
}

export async function isEditalExcluido(id: string, link?: string): Promise<boolean> {
  try {
    const existente = await repo.findById(id);
    if (existente && existente.deletedAt !== null) {
      return true;
    }
    if (link) {
      const existentePorLink = await repo.findByLink(link);
      if (existentePorLink && existentePorLink.deletedAt !== null) {
        return true;
      }
    }
    return false;
  } catch (erro) {
    console.error(`❌ Erro ao verificar se edital ${id} está excluído:`, erro);
    return false;
  }
}
