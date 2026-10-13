import { NextRequest, NextResponse } from 'next/server';
import { lerProgresso } from '@/lib/scraper/progresso-busca';
import { verificarAdmin } from '@/lib/api/auth';

export const dynamic = 'force-dynamic';

/** Andamento da busca em curso (lido pela tela a cada poucos segundos). */
export async function GET(request: NextRequest) {
  const auth = await verificarAdmin(request);
  if (!auth.ok) return auth.response;
  return NextResponse.json(lerProgresso());
}
