import { getAllEditais, saveEdital, Edital } from '../db/editais-store';
import { baixarELerPDFEdital, OpcoesDownload } from './pdf-downloader';
import { analisarEditalComIA } from '../ai/analyzer';
import { extrairRelativePath } from './utils/path-utils';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

/**
 * Processa um único edital, baixando o PDF e rodando a IA.
 */
export async function processarEditalUnico(edital: Edital): Promise<boolean> {
  // ✨ NOVO: Verificar se está fora do escopo TI
  if (edital.foraDoEscopo === true) {
    console.log(`⏭️ [${edital.id}] Edital fora do escopo TI. Pulando.`);
    return false;
  }

  console.log(`\n🚀 Iniciando processamento do edital [${edital.id}] - ${edital.titulo}`);
  console.log(`   🔬 [${edital.tecnologiaFoco}] Score: ${edital.scoreRelevancia}/100 | Confiança IA: ${edital.scoreConfiancaIA}%`);
  console.log(`   🏷️ Palavras-chave: ${edital.palavrasChaveEncontradas?.join(', ') || 'nenhuma'}`);
  
  try {
    // Se for um edital de upload, processa de forma paralela e simplificada, analisando diretamente o texto já extraído
    if (edital.fonteConteudo === 'pdf_upload') {
      console.log(`📤 Edital [${edital.id}] é de UPLOAD. Pulando download e analisando diretamente.`);
      edital.statusAnalise = 'pdf_baixado';
      await saveEdital(edital);
      
      const resultadoIA = await analisarEditalComIA(edital.id, edital.conteudoCompleto || '', { modo: 'completo' });
      if (resultadoIA && resultadoIA.statusAnalise === 'analisado') {
        console.log(`✅ Edital de upload [${edital.id}] processado e catalogado com sucesso.`);
        return true;
      } else {
        console.error(`❌ Falha na análise IA do edital de upload [${edital.id}]`);
        return false;
      }
    }

    // 1. Marcar como em processamento (baixando)
    edital.statusAnalise = 'pendente';
    await saveEdital(edital);
    
    // 2. Preparar opções de download com as 3 estratégias
    const opcoesDownload: OpcoesDownload = {
      pdfUrlS3: edital.pdfUrl,           // PDF pré-assinado do S3
      linkExterno: edital.link,          // Link externo do edital
      descricaoHtml: edital.descricao    // Descrição HTML da API
    };
    
    // 3. Tentar baixar ou extrair conteúdo com fallback automático
    const resultadoExtracao = await baixarELerPDFEdital(
      edital.id, 
      opcoesDownload,
      edital.orgao, 
      edital.titulo, 
      edital.dataLimite
    );
    
    // Atualizar fonte de conteúdo
    edital.fonteConteudo = resultadoExtracao.fonte;
    
    // Atualizar a URL do PDF se achou uma diferente
    if (resultadoExtracao.pdfUrlEncontrada) {
      edital.pdfUrl = resultadoExtracao.pdfUrlEncontrada;
    }
    
    // Se não conseguiu nenhum conteúdo, marcar como sem_pdf
    if (resultadoExtracao.fonte === 'sem_pdf' || !resultadoExtracao.texto) {
      console.warn(`⚠️ Edital [${edital.id}] sem conteúdo disponível. Marcando como 'sem_pdf'.`);
      edital.statusAnalise = 'sem_pdf';
      await saveEdital(edital);
      return false;
    }
    
    edital.statusAnalise = 'pdf_baixado';
    edital.pdfSalvoEm = extrairRelativePath(resultadoExtracao.caminhoArquivo);
    await saveEdital(edital);
    
    // Aguardar antes de chamar a API de IA para evitar rate limit
    await delay(3000);
    
    // 4. Analisar com IA
    const resultadoIA = await analisarEditalComIA(edital.id, resultadoExtracao.texto, { modo: 'completo' });
    
    if (resultadoIA && resultadoIA.statusAnalise === 'analisado') {
      console.log(`✅ Edital [${edital.id}] processado e catalogado com sucesso.`);
      return true;
    } else {
      console.error(`❌ Falha na análise IA do edital [${edital.id}]`);
      return false;
    }
    
  } catch (error: any) {
    console.error(`🔥 Erro crítico ao processar edital [${edital.id}]:`, error.message);
    edital.statusAnalise = 'erro';
    edital.erroAnalise = error.message;
    await saveEdital(edital);
    return false;
  }
}

/**
 * Roda a fila de processamento para todos os editais pendentes.
 */
export async function processarFilaDeEditais() {
  const editais = await getAllEditais(true);
  
  // Pegamos apenas os pendentes ou com erro que queremos re-tentar (opcional)
  const pendentes = editais.filter(e => e.statusAnalise === 'pendente' || !e.statusAnalise);
  
  if (pendentes.length === 0) {
    console.log('✅ Nenhum edital pendente de análise no momento.');
    return;
  }
  
  console.log(`⚙️ Iniciando pipeline: ${pendentes.length} editais pendentes encontrados.`);
  
  for (const edital of pendentes) {
    await processarEditalUnico(edital);
    // Delay entre editais para evitar rate limit e bloqueios em sites
    await delay(5000);
  }
  
  console.log('✅ Fila de processamento concluída.');
}
