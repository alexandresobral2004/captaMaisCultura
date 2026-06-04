/**
 * PIPELINE DE INTEGRAÇÃO - VALIDAÇÃO COM KEYWORDS
 * 
 * Integra a validação com keywords e extração de dados estruturados
 * na pipeline de busca de editais.
 * 
 * Fluxo:
 * 1. Baixar PDF com validação de keywords habilitada
 * 2. Se passar na validação: extrair dados estruturados
 * 3. Salvar tudo no banco de dados
 */

import { Edital, saveEdital, salvarValidacaoKeywords } from '../db/editais-store';
import { baixarELerPDFEdital, OpcoesDownload } from './pdf-downloader';
import { extrairDadosEditais } from './edital-extractor';
import { gerarRelatorioValidacoes, exibirRelatorioPretty } from './keyword-logger';
import { ResultadoValidacaoKeywords } from './keyword-map';

/**
 * Processa edital completo com validação de keywords e extração de dados
 */
export async function processarEditalComKeywords(
  edital: Edital,
  opcaoDownload: OpcoesDownload,
  habilitarExtracao: boolean = true
): Promise<Edital | null> {
  console.log(`\n📋 [PIPELINE] Processando edital: "${edital.titulo}"`);

  try {
    // 1. Baixar e validar com keywords
    console.log(`   1️⃣ Baixando PDF e validando com keywords...`);
    const resultadoDownload = await baixarELerPDFEdital(
      edital.id,
      opcaoDownload,
      edital.orgao,
      edital.titulo,
      edital.dataLimite,
      true // Habilitar validação de keywords
    );

    // Se não passou na validação
    if (!resultadoDownload.validacaoKeywords?.isEdital) {
      console.warn(`   ❌ Não passou na validação de keywords`);
      
      // Salvar resultado da validação mesmo que rejeitado
      if (resultadoDownload.validacaoKeywords) {
        const validacaoCompleta = resultadoDownload.validacaoKeywords as ResultadoValidacaoKeywords;
        await salvarValidacaoKeywords(
          edital.id,
          validacaoCompleta
        );
      }
      
      return null;
    }

    console.log(`   ✅ Validação aprovada (Score: ${resultadoDownload.validacaoKeywords.scoreTotal}%)`);

    // 2. Extrair dados estruturados
    let dadosExtraidos = undefined;
    if (habilitarExtracao && resultadoDownload.texto) {
      console.log(`   2️⃣ Extraindo dados estruturados...`);
      try {
        dadosExtraidos = await extrairDadosEditais(
          resultadoDownload.texto,
          resultadoDownload.validacaoKeywords,
          edital.titulo
        );
        console.log(`   ✅ Extração concluída (Confiança: ${dadosExtraidos.confiancaExtracao}%)`);
      } catch (erro) {
        console.warn(`   ⚠️ Erro na extração de dados:`, erro);
        // Continuar mesmo com erro na extração
      }
    }

    // 3. Salvar tudo no banco
    console.log(`   3️⃣ Salvando no banco de dados...`);
    const editalAtualizado = await salvarValidacaoKeywords(
      edital.id,
      resultadoDownload.validacaoKeywords,
      dadosExtraidos
    );

    // Atualizar campos adicionais
    if (editalAtualizado) {
      editalAtualizado.conteudoCompleto = resultadoDownload.texto;
      editalAtualizado.fonteConteudo = resultadoDownload.fonte;
      editalAtualizado.pdfSalvoEm = resultadoDownload.caminhoArquivo;
      editalAtualizado.pdfUrl = resultadoDownload.pdfUrlEncontrada;
      
      await saveEdital(editalAtualizado);
      console.log(`   ✅ Edital salvo com sucesso`);
      return editalAtualizado;
    }

    return null;
  } catch (erro) {
    console.error(`   ❌ Erro ao processar edital:`, erro);
    return null;
  }
}

/**
 * Processa lote de editais e retorna relatório
 */
export async function processarLoteComKeywords(
  editais: Edital[],
  opcaoDownloadFactory: (ed: Edital) => OpcoesDownload,
  habilitarExtracao: boolean = true
): Promise<{
  processados: number;
  sucesso: number;
  erro: number;
  rejeitados: number;
  editaisProcessados: Edital[];
}> {
  const resultado = {
    processados: editais.length,
    sucesso: 0,
    erro: 0,
    rejeitados: 0,
    editaisProcessados: [] as Edital[]
  };

  console.log(`\n🔄 Processando lote de ${editais.length} editais com validação de keywords...`);

  for (let i = 0; i < editais.length; i++) {
    const edital = editais[i];
    const progresso = `[${i + 1}/${editais.length}]`;
    console.log(`\n${progresso} Processando edital ${edital.id}`);

    try {
      const opcao = opcaoDownloadFactory(edital);
      const editalProcessado = await processarEditalComKeywords(
        edital,
        opcao,
        habilitarExtracao
      );

      if (editalProcessado) {
        resultado.sucesso++;
        resultado.editaisProcessados.push(editalProcessado);
      } else {
        resultado.rejeitados++;
      }
    } catch (erro) {
      console.error(`${progresso} Erro ao processar:`, erro);
      resultado.erro++;
    }

    // Pequeno delay entre processamentos para não sobrecarregar
    if (i < editais.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Gerar relatório final
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📊 RELATÓRIO FINAL DO PROCESSAMENTO COM KEYWORDS`);
  console.log(`${'='.repeat(70)}`);
  console.log(`  Total processado: ${resultado.processados}`);
  console.log(`  ✅ Sucesso: ${resultado.sucesso} (${Math.round((resultado.sucesso / resultado.processados) * 100)}%)`);
  console.log(`  ❌ Rejeitados: ${resultado.rejeitados} (${Math.round((resultado.rejeitados / resultado.processados) * 100)}%)`);
  console.log(`  ⚠️ Erros: ${resultado.erro}`);
  console.log(`${'='.repeat(70)}\n`);

  // Exibir relatório de validações
  const relatorio = gerarRelatorioValidacoes();
  if (relatorio.total > 0) {
    exibirRelatorioPretty(relatorio);
  }

  return resultado;
}

/**
 * Integra validação de keywords ao fluxo de busca semanal
 * (Para ser chamado na pipeline de run-weekly-scan)
 */
export async function habilitarValidacaoKeywordsNaPipeline(): Promise<void> {
  console.log(`\n🔑 Validação com Keywords está ATIVADA para busca semanal`);
  console.log(`   - Threshold: 5+ palavras-chave`);
  console.log(`   - Log detalhado: data/logs/validacoes/`);
  console.log(`   - Dados extraídos são salvos em editais.json`);
}
