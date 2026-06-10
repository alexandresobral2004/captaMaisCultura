import { NextRequest, NextResponse } from 'next/server';
import { logger, LogFilters, LogNivel } from '@/lib/logger';
import { verificarAdmin } from '@/lib/api/auth';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams;

    const filters: LogFilters = {
      nivel: (searchParams.get('nivel') as LogNivel | 'todos') || 'todos',
      cenario: (searchParams.get('cenario') as LogFilters['cenario']) || 'todos',
      acao: (searchParams.get('acao') as LogFilters['acao']) || 'todos',
      dataIni: searchParams.get('dataIni') || undefined,
      dataFim: searchParams.get('dataFim') || undefined,
      busca: searchParams.get('busca') || undefined,
      page: parseInt(searchParams.get('page') || '1', 10),
      limit: parseInt(searchParams.get('limit') || '20', 10),
    };

    const logs = await logger.getLogs(filters);
    const total = await logger.getTotalCount(filters);

    return NextResponse.json({
      success: true,
      data: logs,
      pagination: {
        page: filters.page ?? 1,
        limit: filters.limit ?? 20,
        total,
        pages: Math.ceil(total / (filters.limit ?? 20)),
      },
    });
  } catch (error) {
    console.error('[Logs API] Erro ao buscar logs:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar logs' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await verificarAdmin(request);
    if (!auth.ok) {
      return auth.response;
    }

    const url = new URL(request.url);
    const olderThanDays = url.searchParams.get('olderThanDays');
    const days = olderThanDays ? parseInt(olderThanDays, 10) : undefined;

    const deleted = await logger.clearLogs(days);

    await logger.log({
      nivel: 'info',
      mensagem: `Logs limpos: ${deleted} registros removidos`,
      contexto: 'api',
      caminho: '/api/v1/logs',
      usuarioId: auth.usuario!.id,
    });

    return NextResponse.json({
      success: true,
      deleted,
      message: `${deleted} logs removidos`,
    });
  } catch (error) {
    console.error('[Logs API] Erro ao limpar logs:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao limpar logs' },
      { status: 500 }
    );
  }
}