import { buscarEditaisPortais } from './fetcher';
import { prepararEdital } from './preparar-edital';
import { saveEdital, getEditalPorId, isEditalExcluido } from '../db/editais-store';
import { comecarColeta, comecarProcessamento, registrarItem, terminarBusca, resultadoDoItem, lerProgresso } from './progresso-busca';
import { finalizarBuscaAsync, editalJaProcessado, EstatisticasBusca } from './controle-busca';
import { registrarDecisao } from './funil';
import { pipelineLogger } from './pipeline-logger';
import { JobRepository } from '../jobs/job-repository';

/**
 * Executa uma busca manual por novos editais. Quem chama é o worker (JobRunner), e não a rota web.
 * Grava o resultado na linha de buscas_editais (buscaId) e relança o erro, para o job ficar com ERRO.
 */
export async function executarBuscaManual(jobId: string, buscaId: number): Promise<EstatisticasBusca> {
  let jaExistentes = 0;
  // Snapshot do andamento no próprio job: a tela lê do banco, e não da memória deste processo
  // Dado só de exibição: se a gravação falhar, a busca segue (não pode virar erro por causa disso)
  const salvarSnapshot = async () => {
    try {
      await new JobRepository().gravarProgresso(jobId, lerProgresso());
    } catch (erro) {
      console.error(`[BUSCA ${jobId}] Falha ao gravar o andamento na tela:`, erro);
    }
  };
  comecarColeta();
  await salvarSnapshot();

  try {
    const tempoInicio = Date.now();
    console.log(`🚀 [BUSCA ${jobId}] Iniciando busca consolidada de editais nos portais...`);
    pipelineLogger.logBusca('Iniciando busca consolidada de editais...');
    const novosEditais = await buscarEditaisPortais();

    comecarProcessamento(novosEditais.length);
    await salvarSnapshot();
    console.log(`\n📊 API: ${novosEditais.length} editais localizados. Iniciando download de PDFs e análise IA...`);
    pipelineLogger.logBusca(`Encontrados ${novosEditais.length} editais válidos nos portais. Iniciando processamento...`);
    const editaisAnalisados = [];
    let sucessoCount = 0;
    let erroCount = 0;

    for (const edital of novosEditais) {
      try {
        pipelineLogger.logBusca(`Processando edital: "${edital.titulo}"`);

        // Excluído pelo usuário: não baixa de novo (getEditalPorId não enxerga excluídos)
        if (await isEditalExcluido(edital.id, edital.link)) {
          jaExistentes++;
          registrarDecisao({ editalId: edital.id, titulo: edital.titulo, etapa: 'duplicado', resultado: 'duplicado', motivo: 'Excluído pelo usuário' });
          registrarItem('ja_existia', edital.titulo);
          pipelineLogger.logResultado(edital.id, edital.titulo, 'rejeitado', 'Excluído pelo usuário');
          continue;
        }

        // Já baixado ou avaliado em buscas anteriores: não baixa de novo
        const existente = await getEditalPorId(edital.id);
        if (existente && editalJaProcessado(existente)) {
          jaExistentes++;
          registrarDecisao({ editalId: edital.id, titulo: edital.titulo, etapa: 'duplicado', resultado: 'duplicado', motivo: 'Já existe no banco' });
          registrarItem('ja_existia', edital.titulo);
          pipelineLogger.logResultado(edital.id, edital.titulo, 'rejeitado', 'Já existe no banco');
          continue;
        }

        // Skip se edital está fora do escopo
        if (edital.foraDoEscopo === true) {
          console.log(`⏭️ [${edital.id}] Fora do escopo. Pulando.`);
          pipelineLogger.logResultado(edital.id, edital.titulo, 'rejeitado', 'Fora do escopo');
          erroCount++;
          registrarDecisao({ editalId: edital.id, titulo: edital.titulo, etapa: 'fora_escopo', resultado: 'descartado', motivo: 'Marcado fora do escopo' });
          registrarItem('descartado', edital.titulo);
          continue;
        }
        const preparado = await prepararEdital(edital);

        // Salvar com status 'pendente' para análise manual: a IA só analisa quando o usuário clicar em "Analisar"
        const editalSalvo = await saveEdital({ ...edital, ...preparado.campos });

        console.log(`✅ [${edital.id}] Salvo com status PENDENTE - aguardando análise manual do usuário`);
        pipelineLogger.logResultado(edital.id, edital.titulo, 'salvo', `Salvo como PENDENTE (Score: ${preparado.scoreFinal}) | Fonte: ${preparado.campos.fonteConteudo}`);
        editaisAnalisados.push(editalSalvo);
        sucessoCount++;
        registrarDecisao({
          editalId: edital.id,
          titulo: edital.titulo,
          etapa: 'pontuacao',
          resultado: editalSalvo.statusAnalise === 'descartado' ? 'descartado' : editalSalvo.statusAnalise === 'duvida' ? 'duvida' : 'passou',
          motivo: `Score ${preparado.scoreFinal}, status ${editalSalvo.statusAnalise}`,
          probabilidade: preparado.scoreFinal / 100,
        });
        registrarItem(resultadoDoItem(editalSalvo.statusAnalise, preparado.scoreFinal), edital.titulo);
      } catch (err) {
        console.error(`❌ Erro ao processar edital [${edital.id}]:`, err);
        pipelineLogger.logErro(edital.id, `Erro de processamento: ${(err as Error).message}`);
        pipelineLogger.logResultado(edital.id, edital.titulo, 'erro', (err as Error).message);
        edital.statusAnalise = 'erro';
        edital.erroAnalise = (err as Error).message;
        await saveEdital(edital);
        editaisAnalisados.push(edital);
        erroCount++;
        registrarItem('descartado', edital.titulo);
      } finally {
        // Vale também para os `continue` do laço
        await salvarSnapshot();
      }
    }

    const tempoTotal = ((Date.now() - tempoInicio) / 60000).toFixed(2);
    pipelineLogger.logBusca(`Busca concluída. Sucessos: ${sucessoCount}, Falhas: ${erroCount} em ${tempoTotal} minutos.`);

    const descartados = editaisAnalisados.filter(e => e.statusAnalise === 'descartado').length;
    const novos = sucessoCount - descartados;
    const estatisticas: EstatisticasBusca = { novos, jaExistentes, descartados, comErro: erroCount };
    await finalizarBuscaAsync(buscaId, estatisticas);
    terminarBusca();
    await salvarSnapshot();
    return estatisticas;
  } catch (error) {
    console.error('Erro na busca manual:', error);
    terminarBusca(true);
    await salvarSnapshot();
    // Busca que falhou não gasta o limite semanal
    await finalizarBuscaAsync(buscaId, { novos: 0, jaExistentes, descartados: 0, comErro: 0, mensagem: (error as Error).message }, true);
    throw error;
  }
}
