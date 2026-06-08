import { NextRequest, NextResponse } from 'next/server';
import { ProposalWriterCientifico } from '@/lib/analise-cientifica/writer';
import { Logger } from '@/lib/analise-cientifica/logger';
import { projetos } from '@/lib/analise-cientifica/db-mock';

const logger = new Logger('api/analise');

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now();

  try {
    logger.info(`Iniciando análise de conformidade para projeto: ${params.id}`, 'api/analise');

    const body = await request.json();

    const { projeto, edital } = body;

    if (!projeto || !edital) {
      logger.warn('Projeto ou edital não fornecidos', 'api/analise');
      return NextResponse.json({
        success: false,
        error: 'Projeto e edital são obrigatórios',
      }, { status: 400 });
    }

    const writer = new ProposalWriterCientifico('mini');

    const analise = await writer.analisarConformidade(projeto, {
      titulo: edital.titulo,
      orgao: edital.orgao,
      valor: edital.valor,
      valorMax: edital.valorMax,
      prazoMeses: edital.prazoMeses,
      objetivo: edital.objetivo,
      criteriosAvaliacao: edital.criteriosAvaliacao || [],
      itensFinanciaveis: edital.itensFinanciaveis || [],
      elegibilidade: edital.elegibilidade || [],
      areasTematicas: edital.areasTematicas,
    });

    const duration = Date.now() - startTime;
    logger.info(`Análise concluída em ${duration}ms - Score: ${analise.scoreGeral}%`, 'api/analise', { scoreGeral: analise.scoreGeral });

    // Atualizar no banco em memória se o projeto existir
    const projetoExistente = projetos.get(params.id);
    if (projetoExistente) {
      projetoExistente.analise = analise;
      projetoExistente.scoreCompliance = analise.scoreGeral;
      projetos.set(params.id, projetoExistente);
    }

    return NextResponse.json({
      success: true,
      data: analise,
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error(`Erro na análise após ${duration}ms`, 'api/analise', { error: error.message, stack: error.stack });
    return NextResponse.json({
      success: false,
      error: error.message || 'Erro ao realizar análise de conformidade',
    }, { status: 500 });
  }
}
