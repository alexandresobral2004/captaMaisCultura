import cron, { ScheduledTask } from 'node-cron';
import { enfileirarVarredura, VarreduraEmAndamento } from './enfileirar';
import { limparLimitesExpirados } from '../database/repositories/limites-taxa.repository';
import { apagarLogsPipelineAntigos } from '../scraper/pipeline-eventos';

let taskAgendada: ScheduledTask | null = null;
let taskLimpezaLimites: ScheduledTask | null = null;

/**
 * Inicia o agendamento de varredura semanal
 * Roda toda segunda-feira às 08:00
 */
export function iniciarScheduler() {
  // Expresão cron: "segundo minuto hora dia mês dia-semana"
  // '0 8 * * 1' = segunda-feira (1) às 08:00
  const expressaoCron = '0 8 * * 1';

  console.log('⏰ Configurando agendador de varredura semanal...');
  console.log(`   📅 Horário: Segunda-feira às 08:00`);

  taskAgendada = cron.schedule(expressaoCron, async () => {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 [CRON JOB] Iniciando varredura semanal agendada');
    console.log('='.repeat(70) + '\n');

    try {
      // Só enfileira: o worker (scripts/worker.ts) executa a varredura fora do processo web
      const { jobId } = await enfileirarVarredura();
      console.log(`✅ Varredura agendada na fila (job ${jobId})`);
    } catch (erro) {
      if (erro instanceof VarreduraEmAndamento) {
        console.warn(`⚠️ Varredura agendada ignorada: ${erro.message}`);
      } else {
        console.error('❌ Erro ao enfileirar varredura agendada:', erro);
      }
    }

    console.log('\n' + '='.repeat(70) + '\n');
  });

  // Apaga contagens de limite de taxa já expiradas (login e cadastro), de hora em hora
  taskLimpezaLimites = cron.schedule('0 * * * *', async () => {
    try {
      await limparLimitesExpirados();
    } catch (erro) {
      console.error('❌ Erro ao limpar limites de taxa expirados:', erro);
    }
    // Logs do pipeline com mais de 7 dias (o worker grava; a limpeza fica aqui, junto dos limites)
    try {
      await apagarLogsPipelineAntigos();
    } catch (erro) {
      console.error('❌ Erro ao limpar logs antigos do pipeline:', erro);
    }
  });

  console.log('✅ Agendador iniciado\n');
}

/**
 * Para o agendador
 */
export function pararScheduler() {
  if (taskAgendada) {
    taskAgendada.stop();
    console.log('⏹️ Agendador parado');
  }
  if (taskLimpezaLimites) {
    taskLimpezaLimites.stop();
    taskLimpezaLimites = null;
  }
}

/**
 * Verifica se há task agendada
 */
export function estaAgendado(): boolean {
  return taskAgendada !== null;
}

/**
 * Retorna informações sobre o scheduler
 */
export function obterInfoScheduler() {
  return {
    agendado: estaAgendado(),
    horario: 'Segunda-feira às 08:00',
    expressaoCron: '0 8 * * 1'
  };
}
