import { JobRepository } from './job-repository';
import { JobStatus, JobPhase, JobProgresso, JobResultado, JobRecord, ErroFase } from './job-types';
import { buscarEditaisPortais, filtrarComClassificador } from '../scraper/fetcher';
import { analisarEditalComIA } from '../ai/analyzer';
import { baixarELerPDFEdital, OpcoesDownload } from '../scraper/pdf-downloader';
import { extrairRelativePath } from '../scraper/utils/path-utils';
import { saveEdital, Edital, isEditalExcluido } from '../db/editais-store';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class JobRunner {
  private repository: JobRepository;

  constructor() {
    this.repository = new JobRepository();
  }

  /**
   * Executa o pipeline completo de varredura semanal
   */
  async executar(): Promise<JobResultado> {
    // 1. Verificar se já existe um job rodando
    const jobAtivo = await this.repository.buscarRodando();
    if (jobAtivo) {
      throw new ConflictError(`Já existe um job rodando (ID: ${jobAtivo.id}, Fase: ${jobAtivo.fase})`);
    }

    // 2. Criar novo job
    const jobId = crypto.randomUUID();
    let job = await this.repository.criar(jobId);
    console.log(`\n🚀 [JOB ${jobId}] Iniciando varredura semanal de editais...`);

    const progresso: JobProgresso = {
      totalEncontrados: 0,
      totalValidados: 0,
      totalDownloads: 0,
      totalAnalisados: 0,
      totalErros: 0
    };

    try {
      // ============================================
      // FASE 1: BUSCAR EDITAIS NOS PORTAIS E CLASSIFICAR
      // ============================================
      job = await this.atualizarFase(job.id, JobPhase.BUSCA);
      console.log(`\n📥 [JOB ${jobId}] FASE 1: Buscando e Classificando...`);
      
      let editaisValidos: any[] = [];
      try {
        const itensEncontrados = await buscarEditaisPortais();
        progresso.totalEncontrados = itensEncontrados.length;
        console.log(`   ✅ ${itensEncontrados.length} itens encontrados nos portais`);

        editaisValidos = await filtrarComClassificador(itensEncontrados);
        progresso.totalValidados = editaisValidos.length;
        console.log(`   ✅ ${editaisValidos.length} editais válidos após classificação`);
        
        await this.atualizarProgresso(job.id, JobPhase.BUSCA, progresso);
      } catch (erro: any) {
        // Se a busca falhar totalmente, é um erro fatal para o pipeline
        console.error(`   ❌ Falha fatal na fase de BUSCA: ${erro.message}`);
        await this.repository.registrarErro(job.id, JobPhase.BUSCA, erro.message);
        throw erro;
      }

      if (editaisValidos.length === 0) {
        console.log(`   ⚠️ Nenhum edital válido encontrado. Finalizando job.`);
        return await this.finalizarComSucesso(job.id, progresso);
      }

      // ============================================
      // FASE 2: BAIXAR E LER PDFs
      // ============================================
      job = await this.atualizarFase(job.id, JobPhase.DOWNLOAD);
      console.log(`\n📄 [JOB ${jobId}] FASE 2: Baixando e lendo PDFs...`);

      const editaisProcessar: Edital[] = [];

      for (const edital of editaisValidos) {
        try {
          if (await isEditalExcluido(edital.id, edital.link)) {
            console.log(`   ⏭️ [JOB] Edital [${edital.id}] já está excluído no banco de dados. Pulando download.`);
            continue;
          }

          const opcoesDownload: OpcoesDownload = {
            pdfUrlS3: edital.pdfUrl,
            linkExterno: edital.link,
            descricaoHtml: edital.descricao
          };

          const resultadoExtracao = await baixarELerPDFEdital(
            edital.id,
            opcoesDownload,
            edital.orgao,
            edital.titulo,
            edital.dataLimite
          );

          edital.fonteConteudo = resultadoExtracao.fonte;

          if (resultadoExtracao.fonte !== 'sem_pdf' && resultadoExtracao.texto) {
            progresso.totalDownloads++;
            edital.conteudoCompleto = resultadoExtracao.texto;
            edital.pdfSalvoEm = extrairRelativePath(resultadoExtracao.caminhoArquivo);
            editaisProcessar.push(edital);
          } else {
            edital.statusAnalise = 'sem_pdf';
            await saveEdital(edital);
          }
        } catch (erro: any) {
          console.warn(`   ⚠️ Erro ao baixar PDF [${edital.id}]:`, erro.message);
          edital.statusAnalise = 'erro';
          await saveEdital(edital);
          progresso.totalErros++;
          await this.repository.registrarErro(job.id, JobPhase.DOWNLOAD, `Erro no edital ${edital.id}: ${erro.message}`);
        }
      }
      
      await this.atualizarProgresso(job.id, JobPhase.DOWNLOAD, progresso);
      console.log(`   ✅ ${progresso.totalDownloads} PDFs baixados com sucesso`);

      // ============================================
      // FASE 3: ANÁLISE COM IA
      // ============================================
      job = await this.atualizarFase(job.id, JobPhase.ANALISE);
      console.log(`\n🧠 [JOB ${jobId}] FASE 3: Analisando editais com IA...`);

      for (const edital of editaisProcessar) {
        try {
          console.log(`   Analisando [${edital.id}]...`);
          const editalAnalisado = await analisarEditalComIA(edital.id, edital.conteudoCompleto, { modo: 'completo' });

          if (editalAnalisado) {
            progresso.totalAnalisados++;
            editalAnalisado.statusRevisao = 'pendente';
            await saveEdital(editalAnalisado);
          }
        } catch (erro: any) {
          console.error(`   ❌ Erro ao analisar [${edital.id}]:`, erro.message);
          edital.statusAnalise = 'erro';
          await saveEdital(edital);
          progresso.totalErros++;
          await this.repository.registrarErro(job.id, JobPhase.ANALISE, `Erro no edital ${edital.id}: ${erro.message}`);
        }
      }
      
      await this.atualizarProgresso(job.id, JobPhase.ANALISE, progresso);
      console.log(`   ✅ ${progresso.totalAnalisados} editais analisados`);

      // ============================================
      // FASE 4: CRIAR NOTIFICAÇÃO
      // ============================================
      job = await this.atualizarFase(job.id, JobPhase.NOTIFICACAO);
      console.log(`\n🔔 [JOB ${jobId}] FASE 4: Criando notificação...`);

      if (progresso.totalAnalisados > 0) {
        try {
          const { v4: uuidv4 } = await import('uuid');
          const notificacaoId = uuidv4();
          const NOTIFICACOES_DIR = path.join(process.cwd(), 'data', 'notificacoes');
          
          if (!fs.existsSync(NOTIFICACOES_DIR)) {
            fs.mkdirSync(NOTIFICACOES_DIR, { recursive: true });
          }

          const notif = {
            id: notificacaoId,
            tipo: 'editais_novos',
            titulo: `${progresso.totalAnalisados} novos editais disponíveis`,
            descricao: `Encontrados ${progresso.totalAnalisados} editais aguardando revisão. Acesse o painel para analisar.`,
            quantidade: progresso.totalAnalisados,
            link: '/editais?tab=review',
            urgencia: 'alta',
            lida: false,
            criadoEm: new Date()
          };

          const filePath = path.join(NOTIFICACOES_DIR, `${notif.id}.json`);
          fs.writeFileSync(filePath, JSON.stringify(notif, null, 2), 'utf-8');
          console.log(`   ✅ Notificação criada: ${notif.titulo}`);
        } catch (erro: any) {
          console.error(`   ❌ Erro ao criar notificação:`, erro.message);
          progresso.totalErros++;
          await this.repository.registrarErro(job.id, JobPhase.NOTIFICACAO, erro.message);
        }
      }

      // ============================================
      // FINALIZAR COM SUCESSO
      // ============================================
      return await this.finalizarComSucesso(job.id, progresso);

    } catch (erro: any) {
      // Falha fatal que abortou o pipeline
      console.error(`\n🔥 [JOB ${jobId}] ERRO FATAL NO PIPELINE:`, erro.message);
      
      const jobFinal = await this.repository.finalizar(job.id, JobStatus.ERRO);
      
      return this.formatarResultado(jobFinal!, erro.message);
    }
  }

  private async atualizarFase(id: string, fase: JobPhase): Promise<JobRecord> {
    const job = await this.repository.atualizarFase(id, fase);
    if (!job) throw new Error(`Job ${id} não encontrado ao atualizar fase`);
    return job;
  }

  private async atualizarProgresso(id: string, fase: JobPhase, progresso: JobProgresso): Promise<JobRecord> {
    const job = await this.repository.atualizarFase(id, fase, progresso);
    if (!job) throw new Error(`Job ${id} não encontrado ao atualizar progresso`);
    return job;
  }

  private async finalizarComSucesso(id: string, progresso: JobProgresso): Promise<JobResultado> {
    // Garantir que os últimos contadores foram salvos
    const jobAtualizado = await this.repository.atualizarFase(id, JobPhase.NOTIFICACAO, progresso);
    
    // Marcar como CONCLUIDO (mesmo que haja erros parciais registrados)
    const jobFinal = await this.repository.finalizar(id, JobStatus.CONCLUIDO);
    
    console.log(`\n✅ [JOB ${id}] FINALIZADO COM SUCESSO.`);
    console.log(`   📊 Estatísticas finais:`);
    console.log(`      • Encontrados: ${progresso.totalEncontrados}`);
    console.log(`      • Validados:   ${progresso.totalValidados}`);
    console.log(`      • Downloads:   ${progresso.totalDownloads}`);
    console.log(`      • Analisados:  ${progresso.totalAnalisados}`);
    console.log(`      • Erros Parc.: ${progresso.totalErros}`);
    
    return this.formatarResultado(jobFinal!);
  }

  private formatarResultado(job: JobRecord, erroFatal?: string): JobResultado {
    const inicio = new Date(job.iniciadoEm).getTime();
    const fim = job.finalizadoEm ? new Date(job.finalizadoEm).getTime() : Date.now();
    
    const errosSalvos: ErroFase[] = job.erroDetalhes ? JSON.parse(job.erroDetalhes) : [];
    
    if (erroFatal && job.fase) {
      errosSalvos.push({
        fase: job.fase,
        mensagem: `FATAL: ${erroFatal}`,
        timestamp: new Date().toISOString()
      });
    }

    return {
      jobId: job.id,
      status: job.status,
      totalEncontrados: job.totalEncontrados,
      totalValidados: job.totalValidados,
      totalDownloads: job.totalDownloads,
      totalAnalisados: job.totalAnalisados,
      totalErros: job.totalErros,
      erros: errosSalvos,
      iniciadoEm: job.iniciadoEm,
      finalizadoEm: job.finalizadoEm,
      duracaoMs: fim - inicio
    };
  }
}
