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
  categoriaArea?: string;
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

    console.log(`\n📤 [UPLOAD] Iniciando processamento de upload...`);
    console.log(`   - Nome original: ${options.nomeOriginal}`);
    console.log(`   - Tamanho do buffer: ${options.pdfBuffer.length} bytes`);

    const id = this.gerarId();
    const titulo = options.titulo || this.extrairTituloDoNome(options.nomeOriginal);
    const orgao = options.orgao || 'Upload Manual';

    console.log(`   - ID gerado: ${id}`);
    console.log(`   - Título: ${titulo}`);

    let pdfPath = '';
    let textoExtraido = '';

    // 1. Salvar PDF
    console.log(`\n📄 [UPLOAD] Passo 1: Salvando PDF...`);
    try {
      pdfPath = await this.fileService.salvarPDF(options.pdfBuffer, id, options.nomeOriginal);
      console.log(`   ✅ PDF salvo em: ${pdfPath}`);

      // Verificar se arquivo existe fisicamente
      const fs = require('fs');
      const path = require('path');
      const fullPath = path.join(process.cwd(), 'data', pdfPath);
      console.log(`   📍 Caminho completo: ${fullPath}`);
      console.log(`   📏 Arquivo existe: ${fs.existsSync(fullPath)}`);
      if (fs.existsSync(fullPath)) {
        const stats = fs.statSync(fullPath);
        console.log(`   📊 Tamanho do arquivo: ${stats.size} bytes`);
      }
    } catch (error: any) {
      console.error(`   ❌ Erro ao salvar PDF: ${error.message}`);
      erros.push(`Erro ao salvar PDF: ${error.message}`);
      pdfPath = '';
    }

    // 2. Extrair texto
    if (pdfPath) {
      console.log(`\n🔤 [UPLOAD] Passo 2: Extraindo texto do PDF...`);
      try {
        const fs = require('fs');
        const path = require('path');
        const fullPath = path.join(process.cwd(), 'data', pdfPath);
        const buffer = fs.readFileSync(fullPath);
        console.log(`   📋 Buffer lido: ${buffer.length} bytes`);

        textoExtraido = await this.extrairTextoDePdf(buffer);
        console.log(`   ✅ Texto extraído: ${textoExtraido.length} caracteres`);
      } catch (error: any) {
        console.error(`   ❌ Erro ao extrair texto: ${error.message}`);
        erros.push(`Erro ao extrair texto: ${error.message}`);
        textoExtraido = '';
      }
    } else {
      console.warn(`   ⚠️ Pulando extração de texto pois pdfPath está vazio`);
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

    // 3. Criar edital no banco
    console.log(`\n💾 [UPLOAD] Passo 3: Salvando edital no banco...`);
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
      fonteConteudo: 'pdf_upload',
      pdfPath: pdfPath || null,
      tecnologiaFoco: validacaoIA?.tecnologia || null,
      tipoFerramenta: validacaoIA?.tipo || null,
      scoreRelevancia: validacaoIA?.score || 0,
      scoreConfiancaIa: validacaoIA?.confiança || 0,
      validadoPorIa: true,
      statusAnalise: textoExtraido && textoExtraido.length > 100 ? 'pendente' : 'erro',
      criadoEm: new Date().toISOString(),
      categoriaArea: options.categoriaArea || 'Cultura',
    };
    console.log(`   - fonteConteudo: ${editalData.fonteConteudo}`);
    console.log(`   - conteudoCompleto: ${editalData.conteudoCompleto ? textoExtraido.length + ' chars' : 'null'}`);
    console.log(`   - statusAnalise: ${editalData.statusAnalise}`);
    console.log(`   - pdfPath: ${editalData.pdfPath}`);

    try {
      await this.editalService.criar(editalData);
      console.log(`   ✅ Edital criado no banco com sucesso`);

      // Verificar se edital foi salvo corretamente
      try {
        const editalSalvo = await this.editalService.buscarPorId(id);
        if (editalSalvo) {
          console.log(`   ✅ Edital confirmado no banco:`);
          console.log(`      - fonteConteudo: ${editalSalvo.fonteConteudo}`);
          console.log(`      - conteudoCompleto: ${editalSalvo.conteudoCompleto ? 'presente' : 'ausente'}`);
          console.log(`      - statusAnalise: ${editalSalvo.statusAnalise}`);
        } else {
          console.warn(`   ⚠️ Edital não encontrado após criação!`);
          erros.push('Edital não foi encontrado após criação');
        }
      } catch (verifyError: any) {
        console.warn(`   ⚠️ Erro ao verificar edital criado: ${verifyError.message}`);
      }
    } catch (error: any) {
      console.error(`   ❌ Erro ao criar edital: ${error.message}`);
      if (error.message?.includes('ja existe')) {
        erros.push('Edital com mesmo título já existe');
      } else {
        throw error;
      }
    }

    // ============================================================
    // ANÁLISE COMPLETA COM IA (Pipeline completo igual ao scraper)
    // ============================================================
    console.log(`\n🤖 [UPLOAD] Passo 4: Iniciando análise completa com IA...`);

    if (textoExtraido && textoExtraido.length > 100) {
      // Delay de 3 segundos para evitar rate limit da OpenAI
      console.log(`   ⏳ Aguardando 3s antes de chamar OpenAI...`);
      await new Promise(resolve => setTimeout(resolve, 3000));

      try {
        console.log(`\n🔍 [UPLOAD] Chamando analisarEditalComIA para edital ${id}...`);
        console.log(`   - ID: ${id}`);
        console.log(`   - Texto: ${textoExtraido.length} caracteres`);
        console.log(`   - Modo: completo`);

        const editalAnalisado = await analisarEditalComIA(id, textoExtraido, { modo: 'completo' });

        if (editalAnalisado && editalAnalisado.statusAnalise === 'analisado') {
          console.log(`\n✅ [UPLOAD] Análise completa concluída com sucesso para edital ${id}`);
          console.log(`   - Status: ${editalAnalisado.statusAnalise}`);
          console.log(`   - Revisão: ${editalAnalisado.statusRevisao || 'não definida'}`);

          // Verificar campos preenchidos
          const analise = editalAnalisado.analiseIA;
          if (analise) {
            console.log(`   - Resumo: ${analise.resumo ? 'presente' : 'ausente'}`);
            console.log(`   - Objetivo: ${analise.objetivo ? 'presente' : 'ausente'}`);
            console.log(`   - Elegibilidade: ${analise.elegibilidade ? 'presente' : 'ausente'}`);
            console.log(`   - Critérios: ${analise.criteriosAvaliacao?.length || 0} itens`);
          }
        } else if (editalAnalisado) {
          console.warn(`\n⚠️ [UPLOAD] Análise IA retornou status inesperado para edital ${id}`);
          console.log(`   - Status retornado: ${editalAnalisado.statusAnalise}`);
          console.log(`   - Erro: ${editalAnalisado.erroAnalise || 'não especificado'}`);
          erros.push('Análise IA não concluída corretamente');
        } else {
          console.error(`\n❌ [UPLOAD] analisarEditalComIA retornou null para edital ${id}`);
          erros.push('Análise IA retornou null');
        }
      } catch (error: any) {
        console.error(`\n❌ [UPLOAD] Erro na análise completa do edital ${id}:`, error.message);
        console.error(`   Stack:`, error.stack);
        erros.push(`Análise IA incompleta: ${error.message}`);

        // Atualizar status para erro (mas não falhar o upload)
        try {
          await this.editalService.atualizar(id, {
            statusAnalise: 'erro',
            erroAnalise: error.message,
          });
          console.log(`   - Status atualizado para 'erro' no banco`);
        } catch (updateError: any) {
          console.error(`Erro ao atualizar status de erro:`, updateError.message);
        }
      }
    } else {
      console.warn(`\n⚠️ [UPLOAD] Texto extraído insuficiente (${textoExtraido?.length || 0} chars) para análise completa`);
      console.log(`   Mínimo necessário: 100 caracteres`);
      erros.push('Texto extraído muito curto para análise detalhada');

      // Atualizar status para erro por texto insuficiente
      try {
        await this.editalService.atualizar(id, {
          statusAnalise: 'erro',
          erroAnalise: `Texto extraído muito curto: ${textoExtraido?.length || 0} chars (mínimo: 100)`,
        });
      } catch (e: any) {
        console.warn(`Erro ao atualizar status de erro:`, e.message);
      }
    }

    console.log(`\n📊 [UPLOAD] Resumo final do processamento:`);
    console.log(`   - ID: ${id}`);
    console.log(`   - Título: ${titulo.substring(0, 100)}`);
    console.log(`   - Texto extraído: ${textoExtraido.length} chars`);
    console.log(`   - Erros: ${erros.length}`);
    if (erros.length > 0) {
      erros.forEach((e, i) => console.log(`      ${i + 1}. ${e}`));
    }

    // Se analisado com sucesso, buscar edital atualizado com os dados completos da IA
    let finalEdital = null;
    try {
      finalEdital = await this.editalService.buscarPorId(id);
    } catch (e) {
      console.warn('Erro ao buscar edital final para retorno:', e);
    }

    return {
      id,
      titulo: titulo.substring(0, 200),
      textoExtraido: textoExtraido.substring(0, 500),
      tecnologiaFoco: finalEdital?.tecnologiaFoco || validacaoIA?.tecnologia || 'N/A',
      tipoFerramenta: finalEdital?.tipoFerramenta || validacaoIA?.tipo || 'N/A',
      scoreRelevancia: finalEdital?.analiseIA?.scoreAdequacao || validacaoIA?.score || 0,
      confiancaIA: finalEdital?.scoreConfiancaIa || validacaoIA?.confiança || 0,
      erros
    };
  }

  async reanalisarEditalUpload(id: string): Promise<boolean> {
    console.log(`\n🔄 [UPLOAD] Reanalisando edital de upload ${id}...`);
    try {
      const edital = await this.editalService.buscarPorId(id);
      if (!edital) {
        throw new Error('Edital não encontrado');
      }

      const relativePath = (edital as any).pdfSalvoEm || (edital as any).pdfPath;
      if (!relativePath) {
        throw new Error('Caminho do PDF não encontrado para este edital');
      }

      const path = require('path');
      const fs = require('fs');
      const fullPath = path.join(process.cwd(), 'data', relativePath);
      console.log(`   📍 Caminho do PDF: ${fullPath}`);

      if (!fs.existsSync(fullPath)) {
        throw new Error(`Arquivo PDF não encontrado fisicamente: ${fullPath}`);
      }

      const buffer = fs.readFileSync(fullPath);
      const textoExtraido = await this.extrairTextoDePdf(buffer);

      if (!textoExtraido || textoExtraido.length < 100) {
        throw new Error('Texto extraído muito curto para análise detalhada');
      }

      // Atualizar conteudoCompleto e fonte no banco
      await this.editalService.atualizar(id, {
        conteudoCompleto: textoExtraido,
        fonteConteudo: 'pdf_upload',
        statusAnalise: 'pendente'
      });

      // Rodar análise completa por IA
      const editalAnalisado = await analisarEditalComIA(id, textoExtraido, { modo: 'completo' });

      if (editalAnalisado && editalAnalisado.statusAnalise === 'analisado') {
        console.log(`✅ [UPLOAD] Re-análise completa concluída com sucesso para edital ${id}`);
        return true;
      } else {
        throw new Error(editalAnalisado?.erroAnalise || 'Falha na análise por IA');
      }
    } catch (error: any) {
      console.error(`❌ [UPLOAD] Erro na re-análise do edital ${id}:`, error.message);
      try {
        await this.editalService.atualizar(id, {
          statusAnalise: 'erro',
          erroAnalise: error.message
        });
      } catch (e) {}
      return false;
    }
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
    console.log(`\n🔍 [EXTRACAO] Iniciando extração de texto do PDF...`);
    console.log(`   - Tamanho do buffer: ${buffer.length} bytes`);

    // Verificar se é um PDF válido (magic number)
    const isPdf = buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
    console.log(`   - É PDF válido (%PDF): ${isPdf ? '✅' : '❌'}`);

    if (!isPdf) {
      console.warn('   ⚠️ Buffer não parece ser um PDF válido!');
      return '';
    }

    // ============================================================
    // ESTRATÉGIA 1: LlamaParse (preserva tabelas e formatação)
    // ============================================================
    if (process.env.LLAMA_CLOUD_API_KEY) {
      console.log(`\n🦙 [EXTRACAO] Estratégia 1: LlamaParse...`);
      try {
        const textoLlama = await extrairTextoLlamaParse(buffer);
        if (textoLlama && textoLlama.length > 100) {
          console.log(`   ✅ LlamaParse: ${textoLlama.length} caracteres (Markdown com tabelas)`);
          return textoLlama;
        }
      } catch (erro) {
        console.warn(`   ⚠️ LlamaParse falhou: ${(erro as Error).message}`);
        console.log(`   → Tentando pdf-parse como fallback...`);
      }
    } else {
      console.log(`   ⚠️ LLAMA_CLOUD_API_KEY não configurada, pulando LlamaParse`);
    }

    // ============================================================
    // ESTRATÉGIA 2: pdf-parse v2 (Mehmet Kozan)
    // ============================================================
    console.log(`\n📄 [EXTRACAO] Estratégia 2: pdf-parse v2...`);

    const pdfParseModule = require('pdf-parse');
    const PDFParseClass = pdfParseModule.PDFParse || (pdfParseModule.default && pdfParseModule.default.PDFParse) || pdfParseModule;

    if (!PDFParseClass) {
      console.warn(`   ❌ Classe PDFParse não encontrada no módulo.`);
      return '';
    }

    // Estratégia 2a: Usar parser.getText() para obter o texto completo
    try {
      console.log(`   - Tentando obter texto completo via parser.getText()...`);
      const parser = new (PDFParseClass as any)({ data: buffer });
      const result = await parser.getText();
      if (result && result.text && result.text.trim().length > 100) {
        console.log(`   ✅ Texto completo extraído via parser.getText() (${result.text.length} chars)`);
        return result.text.trim();
      }
    } catch (errGetText: any) {
      console.warn(`   ℹ️ parser.getText() falhou: ${errGetText.message}`);
    }

    // Estratégia 2b: Fallback para getPage(1) caso queira pelo menos a primeira página
    try {
      console.log(`   - Fallback para getPage(1)...`);
      const parser = new (PDFParseClass as any)({ data: buffer });
      const data = await parser.getPage(1);
      const text = data?.text || "";
      if (text.trim().length > 100) {
        console.log(`   ✅ Texto da página 1 extraído via getPage(1) (${text.length} chars)`);
        return text.trim();
      }
    } catch (errGetPage: any) {
      console.warn(`   ℹ️ parser.getPage(1) falhou: ${errGetPage.message}`);
    }

    // Estratégia 2c: Chamada como função (compatibilidade legado)
    try {
      console.log(`   - Fallback para chamada como função...`);
      const data = await PDFParseClass(buffer);
      const text = data.text || "";
      if (text.trim().length > 100) {
        console.log(`   ✅ Texto extraído via chamada direta de função (${text.length} chars)`);
        return text.trim();
      }
    } catch (errFunc: any) {
      console.warn(`   ℹ️ PDFParse como função falhou: ${errFunc.message}`);
    }

    console.warn(`   ❌ Nenhuma estratégia de extração funcionou`);
    return '';
  }
}