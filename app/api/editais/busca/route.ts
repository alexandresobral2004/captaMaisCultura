import { NextRequest, NextResponse } from 'next/server';
import { iniciarBuscaManualAsync } from '@/lib/scraper/controle-busca';
import { verificarAdmin } from '@/lib/api/auth';

/**
 * Enfileira uma busca manual por novos editais. Não executa a busca: quem faz isso é o worker.
 * 202: enfileirada (o andamento é consultado em /progresso?jobId=...).
 * 409: já há busca ou varredura ativa. 429: limite semanal atingido.
 */
export async function POST(request: NextRequest) {
  const auth = await verificarAdmin(request);
  if (!auth.ok) {
    return auth.response;
  }

  const inicio = await iniciarBuscaManualAsync();
  if (!inicio.ok) {
    if (inicio.motivo === 'em_andamento') {
      return NextResponse.json(
        { error: 'Já existe uma busca em andamento. Aguarde terminar.', situacao: inicio.situacao },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Limite de 2 buscas por semana atingido.', situacao: inicio.situacao },
      { status: 429 }
    );
  }

  return NextResponse.json({ jobId: inicio.jobId }, { status: 202 });
}
