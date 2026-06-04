import { pipelineLogger } from '@/lib/scraper/pipeline-logger';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const stream = new ReadableStream({
    start(controller) {
      // Send the current buffer so the client is immediately up-to-date
      const buffer = pipelineLogger.getBuffer();
      
      for (const event of buffer) {
        controller.enqueue(`data: ${JSON.stringify(event)}\n\n`);
      }
      
      // Subscribe to new events
      const unsubscribe = pipelineLogger.subscribe((event) => {
        controller.enqueue(`data: ${JSON.stringify(event)}\n\n`);
      });
      
      // Heartbeat every 15s to keep the connection alive
      const heartbeat = setInterval(() => {
        controller.enqueue(`: heartbeat\n\n`);
      }, 15000);
      
      // Cleanup when the connection is closed
      req.signal.addEventListener('abort', () => {
        unsubscribe();
        clearInterval(heartbeat);
        controller.close();
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
