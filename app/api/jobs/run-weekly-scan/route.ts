import { NextRequest, NextResponse } from 'next/server';
import { verificarAdmin } from '@/lib/api/auth';
import { enfileirarVarredura, VarreduraEmAndamento } from '@/lib/jobs/enfileirar';
import { scanTokenValido, extrairScanTokenDosHeaders } from '@/lib/api/scan-token';

/**
 * Verifica autenticação: aceita token de script OU cookie de admin
 */
async function verificarAutenticacao(request: NextRequest): Promise<{ ok: boolean; response?: NextResponse }> {
  // 1. Token de script via header (Authorization: Bearer ou X-Scan-Token)
  const tokenHeader = extrairScanTokenDosHeaders(request.headers);
  if (tokenHeader) {
    return scanTokenValido(tokenHeader)
      ? { ok: true }
      : { ok: false, response: NextResponse.json({ error: 'Token inválido' }, { status: 401 }) };
  }

  // 2. Token no body (POST de scripts)
  const body = await request.clone().json().catch(() => ({}));
  if (body?.token) {
    return typeof body.token === 'string' && scanTokenValido(body.token)
      ? { ok: true }
      : { ok: false, response: NextResponse.json({ error: 'Token inválido' }, { status: 401 }) };
  }

  // 3. Verificar cookie de admin (para acesso via UI)
  const auth = await verificarAdmin(request);
  if (!auth.ok) {
    return { ok: false, response: auth.response };
  }

  return { ok: true };
}

export async function GET(request: NextRequest) {
  const auth = await verificarAutenticacao(request);
  if (!auth.ok) {
    return auth.response!;
  }

  return executarVarreduraSemanal();
}

export async function POST(request: NextRequest) {
  const auth = await verificarAutenticacao(request);
  if (!auth.ok) {
    return auth.response!;
  }

  return executarVarreduraSemanal();
}

/**
 * Enfileira a varredura semanal. Quem executa é o worker (scripts/worker.ts),
 * para a varredura não rodar dentro do processo que atende os usuários.
 */
async function executarVarreduraSemanal() {
  try {
    const { jobId } = await enfileirarVarredura();
    return NextResponse.json({
      success: true,
      mensagem: 'Varredura enfileirada para o worker',
      jobId,
      timestamp: new Date().toISOString()
    }, { status: 202 });

  } catch (erro: any) {
    if (erro instanceof VarreduraEmAndamento) {
      return NextResponse.json({
        success: false,
        error: erro.message,
      }, { status: 409 });
    }
    return NextResponse.json({
      success: false,
      error: erro.message,
    }, { status: 500 });
  }
}
