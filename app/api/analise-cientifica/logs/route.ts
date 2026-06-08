import { NextRequest, NextResponse } from 'next/server';
import { Logger, LogFilters, LogLevel } from '@/lib/analise-cientifica/logger';

// Instância singleton para manter logs entre requisições
const logger = new Logger('api');

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const filters: LogFilters = {};

    const level = searchParams.get('level');
    if (level && ['info', 'warn', 'error', 'debug'].includes(level)) {
      filters.level = level as LogLevel;
    }

    const context = searchParams.get('context');
    if (context) filters.context = context;

    const startDate = searchParams.get('startDate');
    if (startDate) filters.startDate = startDate;

    const endDate = searchParams.get('endDate');
    if (endDate) filters.endDate = endDate;

    const search = searchParams.get('search');
    if (search) filters.search = search;

    const logs = logger.getLogs(filters);
    const stats = Logger.getStats();

    return NextResponse.json({
      success: true,
      data: {
        logs,
        stats,
      },
    });
  } catch (error: any) {
    logger.error('Erro ao buscar logs', 'api/logs', { error: error.message });
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    logger.clearLogs();
    logger.info('Logs limpos pelo usuário', 'api/logs');

    return NextResponse.json({
      success: true,
      message: 'Logs limpos com sucesso',
    });
  } catch (error: any) {
    logger.error('Erro ao limpar logs', 'api/logs', { error: error.message });
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
