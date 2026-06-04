import { NextRequest, NextResponse } from 'next/server';
import { verificarAdmin } from '@/lib/api/auth';
import { JobRunner, ConflictError } from '@/lib/jobs/job-runner';

/**
 * Verifica autenticação: aceita token de script OU cookie de admin
 */
async function verificarAutenticacao(request: NextRequest): Promise<{ ok: boolean; response?: NextResponse }> {
  // 1. Verificar token no query string (para scripts)
  const url = new URL(request.url);
  const tokenQuery = url.searchParams.get('token');
  
  if (tokenQuery) {
    if (tokenQuery !== (process.env.SCAN_TOKEN || 'capta-mais-scan-token-secret-2026')) {
      return { ok: false, response: NextResponse.json({ error: 'Token inválido' }, { status: 401 }) };
    }
    return { ok: true };
  }

  // 2. Verificar token no body (para POST de scripts)
  try {
    const body = await request.clone().json().catch(() => ({}));
    const tokenBody = body.token;
    
    if (tokenBody) {
      if (tokenBody !== (process.env.SCAN_TOKEN || 'capta-mais-scan-token-secret-2026')) {
        return { ok: false, response: NextResponse.json({ error: 'Token inválido' }, { status: 401 }) };
      }
      return { ok: true };
    }
  } catch {
    // Ignorar erro ao parsear body
  }

  // 3. Verificar cookie de admin (para acesso via UI)
  const auth = verificarAdmin(request);
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
 * Executa a varredura semanal completa usando o novo JobRunner
 */
async function executarVarreduraSemanal() {
  const runner = new JobRunner();

  try {
    const resultado = await runner.executar();
    
    const statusCode = resultado.status === 'ERRO' ? 500 : 200;
    
    return NextResponse.json({
      success: resultado.status !== 'ERRO',
      mensagem: resultado.status !== 'ERRO' ? 'Varredura completada com sucesso' : 'Varredura completada com erro fatal',
      estatisticas: {
        totalEditaisValidos: resultado.totalValidados,
        quantidade: resultado.totalDownloads, // Mantendo compatibilidade com old response
        ...resultado
      },
      timestamp: new Date().toISOString()
    }, { status: statusCode });

  } catch (erro: any) {
    if (erro instanceof ConflictError) {
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
