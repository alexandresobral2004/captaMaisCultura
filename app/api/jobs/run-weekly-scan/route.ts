import { NextRequest, NextResponse } from 'next/server';
import { verificarAdmin } from '@/lib/api/auth';
import { JobRunner, ConflictError } from '@/lib/jobs/job-runner';
import { JobRepository } from '@/lib/jobs/job-repository';
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
    return scanTokenValido(body.token)
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
 * Executa a varredura semanal completa usando o novo JobRunner
 */
async function executarVarreduraSemanal() {
  const repository = new JobRepository();

  try {
    const jobAtivo = await repository.buscarRodando();
    if (jobAtivo) {
      return NextResponse.json({
        success: false,
        error: `Já existe um job rodando (ID: ${jobAtivo.id}, Fase: ${jobAtivo.fase})`,
      }, { status: 409 });
    }

    const runner = new JobRunner();
    runner.executar().catch(erro => {
      console.error('❌ Erro na execução do Job em background:', erro);
    });

    return NextResponse.json({
      success: true,
      mensagem: 'Varredura semanal iniciada em background',
      timestamp: new Date().toISOString()
    }, { status: 202 });

  } catch (erro: any) {
    return NextResponse.json({
      success: false,
      error: erro.message,
    }, { status: 500 });
  }
}
