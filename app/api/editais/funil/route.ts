import { NextRequest, NextResponse } from 'next/server';
import { getRawDb } from '@/lib/database/db';
import { verificarAdmin } from '@/lib/api/auth';
import { resumoDoFunil } from '@/lib/scraper/funil';

/** Funil de filtragem: quantos editais passaram, ficaram em dúvida ou caíram em cada etapa. */
export async function GET(request: NextRequest) {
  const auth = await verificarAdmin(request);
  if (!auth.ok) return auth.response;

  const dias = Number(request.nextUrl.searchParams.get('dias'));
  const desde = Number.isFinite(dias) && dias > 0 ? new Date(Date.now() - dias * 86_400_000).toISOString() : undefined;
  return NextResponse.json({ etapas: resumoDoFunil(getRawDb(), desde) });
}
