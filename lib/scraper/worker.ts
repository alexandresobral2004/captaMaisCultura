import { buscarEditaisPortais } from './fetcher';
import { processarFilaDeEditais } from './pipeline';

/**
 * Executa o ciclo completo de busca, download e catalogação automatizada.
 */
export async function runBackgroundWorker() {
  console.log('\n======================================================');
  console.log('🔄 [WORKER] Iniciando rotina automatizada de busca de editais...');
  console.log(`⏰ Hora de execução: ${new Date().toISOString()}`);
  
  try {
    const novosEditais = await buscarEditaisPortais();
    
    if (novosEditais.length > 0) {
      console.log(`🔄 [WORKER] ${novosEditais.length} editais novos localizados.`);
    }

    // Aciona a fila do pipeline que pega todos pendentes do DB
    await processarFilaDeEditais();

    console.log(`✅ [WORKER] Rotina concluída!`);
    console.log('======================================================\n');
  } catch (error) {
    console.error('❌ [WORKER] Erro fatal na rotina automatizada:', error);
  }
}
