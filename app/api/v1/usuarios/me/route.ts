import { NextRequest, NextResponse } from 'next/server';
import { obterUsuarioLogado } from '@/lib/api/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const usuario = await obterUsuarioLogado(request);
  if (!usuario) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  return NextResponse.json(usuario);
}
