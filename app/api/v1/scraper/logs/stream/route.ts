import { NextRequest } from 'next/server';
import { lerDepoisDePipeline, lerUltimosPipeline, ultimoIdPipeline } from '@/lib/scraper/pipeline-eventos';

export const dynamic = 'force-dynamic';

/** Intervalo de leitura do banco por cursor (id > último enviado). */
const INTERVALO_LEITURA_MS = 1500;
const HEARTBEAT_MS = 15000;
const HISTORICO_EVENTOS = 200;

/**
 * Stream SSE dos logs do pipeline. Quem grava é o worker; esta conexão só lê o banco,
 * então funciona em qualquer réplica da web.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const includeHistory = url.searchParams.get('history') !== 'false';
  const encoder = new TextEncoder();

  let cursor = 0;
  let parado = false;
  let timerLeitura: ReturnType<typeof setTimeout> | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const parar = () => {
    parado = true;
    if (timerLeitura) clearTimeout(timerLeitura);
    if (heartbeat) clearInterval(heartbeat);
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Registrado antes de qualquer await: uma queda durante o histórico também para os timers
      req.signal.addEventListener('abort', () => {
        parar();
        try {
          controller.close();
        } catch {
          // Já fechado pelo cancel()
        }
      });
      if (req.signal.aborted) parar();

      const enviar = (linha: string) => controller.enqueue(encoder.encode(linha));
      const enviarEventos = (eventos: { id: number; detalhes: string | null }[]) => {
        for (const evento of eventos) {
          enviar(`data: ${evento.detalhes ?? '{}'}\n\n`);
          cursor = evento.id;
        }
      };

      // Histórico termina em `ate`; o polling começa depois dele: nada repetido, nada perdido
      const ate = await ultimoIdPipeline();
      if (parado) return;
      cursor = ate;
      const historico = includeHistory ? await lerUltimosPipeline(ate, HISTORICO_EVENTOS) : [];
      if (parado) return;
      enviarEventos(historico);

      const ciclo = async () => {
        if (parado) return;
        try {
          const novos = await lerDepoisDePipeline(cursor);
          if (parado) return;
          enviarEventos(novos);
        } catch {
          // Leitura falhou: tenta de novo no próximo ciclo. Sem detalhes do erro no log da web.
          console.error('[SSE pipeline] Falha ao ler logs do pipeline');
        }
        if (!parado) timerLeitura = setTimeout(ciclo, INTERVALO_LEITURA_MS);
      };
      if (parado) return;
      timerLeitura = setTimeout(ciclo, INTERVALO_LEITURA_MS);

      heartbeat = setInterval(() => {
        if (parado) return;
        try {
          enviar(': heartbeat\n\n');
        } catch {
          parar();
        }
      }, HEARTBEAT_MS);
    },
    cancel() {
      parar();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
