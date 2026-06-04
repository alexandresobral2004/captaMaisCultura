import cron, { ScheduledTask } from 'node-cron';

let taskAgendada: ScheduledTask | null = null;

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
      // Chamar a API de varredura
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      const token = process.env.SCAN_TOKEN || '';

      const url = `${baseUrl}/api/jobs/run-weekly-scan${token ? `?token=${token}` : ''}`;

      console.log(`📡 Chamando: ${url}`);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const resultado = await response.json();

      if (response.ok) {
        console.log('✅ Varredura agendada executada com sucesso');
        console.log(`📊 Resultados:`, resultado.estatisticas);
      } else {
        console.error('❌ Erro na varredura agendada:', resultado.error);
      }
    } catch (erro) {
      console.error('❌ Erro ao executar varredura agendada:', erro);
    }

    console.log('\n' + '='.repeat(70) + '\n');
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
