import { EditalService } from './edital.service';
import { FileService } from './file.service';
import { validarComOpenAI } from '../../filtros-ti/openai-classifier';
import { analisarEditalComIA } from '../../ai/analyzer';
import { extrairTextoLlamaParse } from '../../scraper/llamaparse-extractor';

interface UploadOptions {
  titulo?: string;
  orgao?: string;
  pdfBuffer: Buffer;
  nomeOriginal: string;
}

interface UploadResult {
  id: string;
  titulo: string;
  textoExtraido: string;
  tecnologiaFoco: string;
  tipoFerramenta: string;
  scoreRelevancia: number;
  confiancaIA: number;
  erros: string[];
}

export class EditalUploadService {
  private editalService: EditalService;
  private fileService: FileService;

  constructor() {
    this.editalService = new EditalService();
    this.fileService = new FileService();
  }

  async processarUpload(options: UploadOptions): Promise<UploadResult> {
    const erros: string[] = [];
    
    const id = this.gerarId();
    const titulo = options.titulo || this.extrairTituloDoNome(options.nomeOriginal);
    const orgao = options.orgao || 'Upload Manual';
    
    let pdfPath = '';
    let textoExtraido = '';
    
    try {
      pdfPath = await this.fileService.salvarPDF(options.pdfBuffer, id, options.nomeOriginal);
    } catch (error: any) {
      erros.push(`Erro ao salvar PDF: ${error.message}`);
      pdfPath = '';
    }

    if (pdfPath) {
      try {
        const fs = require('fs');
        const path = require('path');
        const fullPath = path.join(process.cwd(), 'data', pdfPath);
        const buffer = fs.readFileSync(fullPath);
        
        textoExtraido = await this.extrairTextoDePdf(buffer);
      } catch (error: any) {
        erros.push(`Erro ao extrair texto: ${error.message}`);
        textoExtraido = '';
      }
    }

    let validacaoIA = {
      válido: false,
      tecnologia: 'OUTRO_COMPUTACAO' as any,
      tipo: 'OUTRO' as any,
      score: 50,
      razão: 'Upload manual sem análise IA',
      confiança: 30
    };

    if (textoExtraido && textoExtraido.length > 50) {
      try {
        const resultado = await validarComOpenAI(
          titulo,
          textoExtraido,
          undefined,
          orgao,
          undefined,
          undefined
        );
        
        if (resultado.ok) {
          validacaoIA = {
            válido: resultado.válido,
            tecnologia: resultado.tecnologia || resultado.categoria || 'OUTRO_COMPUTACAO',
            tipo: resultado.tipo || resultado.tipoFerramenta || 'OUTRO',
            score: resultado.score || 50,
            razão: resultado.razão || 'Análise IA',
            confiança: resultado.confiança || resultado.confianca || 50
          };
        } else {
          erros.push(`Análise IA retornou erro: ${resultado.mensagem || resultado.erroTipo}`);
        }
      } catch (error: any) {
        erros.push(`Erro na análise IA: ${error.message}`);
      }
    }

    const editalData: any = {
      id,
      titulo: titulo.substring(0, 500),
      orgao,
      valor: 'A consultar',
      dataLimite: '9999-12-31',
      status: 'Aberto',
      link: '#',
      descricao: textoExtraido ? textoExtraido.substring(0, 2000) : '',
      conteudoCompleto: textoExtraido || null,
      fonteConteudo: textoExtraido ? 'pdf_upload' : 'sem_pdf',
      pdfPath: pdfPath || null,
      tecnologiaFoco: validacaoIA?.tecnologia || null,
      tipoFerramenta: validacaoIA?.tipo || null,
      scoreRelevancia: validacaoIA?.score || 0,
      scoreConfiancaIa: validacaoIA?.confiança || 0,
      validadoPorIa: true,
      statusAnalise: textoExtraido ? 'pendente' : 'erro',
      criadoEm: new Date().toISOString(),
    };

    try {
      await this.editalService.criar(editalData);
    } catch (error: any) {
      if (error.message?.includes('ja existe')) {
        erros.push('Edital com mesmo título já existe');
      } else {
        throw error;
      }
    }

    // ============================================================
    // ANÁLISE COMPLETA COM IA (Pipeline completo igual ao scraper)
    // ============================================================
    console.log(`\n📄 [Upload] Edital ${id} criado. Iniciando análise completa...`);
    
    // Delay de 5 segundos para evitar rate limit da OpenAI
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    if (textoExtraido && textoExtraido.length > 100) {
      try {
        console.log(`🔍 [Upload] Chamando analisarEditalComIA para edital ${id}...`);
        
        const editalAnalisado = await analisarEditalComIA(id, textoExtraido, { modo: 'completo' });
        
        if (editalAnalisado && editalAnalisado.statusAnalise === 'analisado') {
          console.log(`✅ [Upload] Análise completa concluída com sucesso para edital ${id}`);
          console.log(`   Status: ${editalAnalisado.statusAnalise}`);
          console.log(`   Revisão: ${editalAnalisado.statusRevisao || 'não definida'}`);
        } else {
          console.warn(`⚠️ [Upload] Análise IA retornou status inesperado para edital ${id}`);
          erros.push('Análise IA não concluída corretamente');
        }
      } catch (error: any) {
        console.error(`❌ [Upload] Erro na análise completa do edital ${id}:`, error.message);
        erros.push(`Análise IA incompleta: ${error.message}`);
        
        // Atualizar status para erro (mas não falhar o upload)
        try {
          await this.editalService.atualizar(id, {
            statusAnalise: 'erro',
            erroAnalise: error.message,
          });
        } catch (updateError: any) {
          console.error(`Erro ao atualizar status de erro:`, updateError.message);
        }
      }
    } else {
      console.warn(`⚠️ [Upload] Texto extraído insuficiente (${textoExtraido?.length || 0} chars) para análise completa`);
      erros.push('Texto extraído muito curto para análise detalhada');
    }

    return {
      id,
      titulo: titulo.substring(0, 200),
      textoExtraido: textoExtraido.substring(0, 500),
      tecnologiaFoco: validacaoIA?.tecnologia || 'N/A',
      tipoFerramenta: validacaoIA?.tipo || 'N/A',
      scoreRelevancia: validacaoIA?.score || 0,
      confiancaIA: validacaoIA?.confiança || 0,
      erros
    };
  }

  private gerarId(): string {
    return `upload-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  private extrairTituloDoNome(nomeOriginal: string): string {
    let titulo = nomeOriginal;
    
    titulo = titulo.replace(/\.pdf$/i, '');
    titulo = titulo.replace(/_/g, ' ');
    titulo = titulo.replace(/-/g, ' ');
    titulo = titulo.replace(/\d{4}[-\/]\d{2}[-\/]\d{2}/g, ' ');
    titulo = titulo.replace(/edital[_ -]*/gi, ' ');
    titulo = titulo.replace(/\s+/g, ' ').trim();
    
    return titulo || 'Edital sem título';
  }

  private async extrairTextoDePdf(buffer: Buffer): Promise<string> {
    let textoNativo = '';
    
    // 1. Tentar extrair com pdf-parse nativo
    try {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      textoNativo = data.text || '';
      console.log(`📄 [Upload] Texto extraído com pdf-parse: ${textoNativo.length} chars`);
    } catch (error: any) {
      console.warn('⚠️ [Upload] Erro ao extrair texto com pdf-parse:', error.message);
    }

    // 2. Se texto nativo for muito curto (< 100 chars), tentar LlamaParse
    if (textoNativo.length < 100) {
      console.log(`🔄 [Upload] Texto insuficiente (${textoNativo.length} chars). Tentando LlamaParse...`);
      
      try {
        const textoLlama = await extrairTextoLlamaParse(buffer);
        
        if (textoLlama && textoLlama.length > textoNativo.length) {
          console.log(`✅ [Upload] LlamaParse retornou ${textoLlama.length} chars (melhor que ${textoNativo.length})`);
          return textoLlama;
        } else if (!textoLlama) {
          console.warn('⚠️ [Upload] LlamaParse retornou vazio');
        }
      } catch (error: any) {
        console.warn('⚠️ [Upload] Erro ao usar LlamaParse:', error.message);
        console.warn('   Continuando com texto nativo (pode não ser suficiente para análise)');
      }
    }

    return textoNativo;
  }
}