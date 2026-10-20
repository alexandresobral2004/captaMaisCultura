import { NextRequest, NextResponse } from 'next/server';
import { situacaoDaBuscaAsync } from '@/lib/scraper/controle-busca';
import { verificarAdmin } from '@/lib/api/auth';

export const dynamic = 'force-dynamic';

/** Quantas buscas por novos editais ainda estão disponíveis esta semana. */
export async function GET(request: NextRequest) {
  const auth = await verificarAdmin(request);
  if (!auth.ok) return auth.response;
  return NextResponse.json(await situacaoDaBuscaAsync());
}
