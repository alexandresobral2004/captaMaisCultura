import { NextRequest, NextResponse } from 'next/server';
import { ProjetoService } from '@/lib/database/services/projeto.service';
import { ProposalWriter } from '@/lib/ai/writer';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface EditalContext {
  titulo: string;
  orgao: string;
  valor?: number;
  valorMax?: number;
  prazoMeses?: number;
  objetivo: string;
  criteriosAvaliacao: string[];
  itensFinanciaveis: string[];
  elegibilidade: string[];
  areasTematicas?: string[];
}

function normalizeToStringArray(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((v: any) => typeof v === 'string');
  if (typeof value === 'string') return [value];
  return [];
}

function normalizeElegibilidade(elegibilidade: any): string[] {
  if (!elegibilidade) return [];
  if (Array.isArray(elegibilidade)) return elegibilidade.filter((v: any) => typeof v === 'string');
  if (typeof elegibilidade === 'string') return [elegibilidade];
  if (typeof elegibilidade === 'object') {
    const parts: string[] = [];
    if (elegibilidade.tiposProponentes?.length) {
      parts.push(`Proponentes: ${elegibilidade.tiposProponentes.join(', ')}`);
    }
    if (elegibilidade.requisitos?.length) {
      parts.push(`Requisitos: ${elegibilidade.requisitos.join(', ')}`);
    }
    if (elegibilidade.restricoes?.length) {
      parts.push(`Restricoes: ${elegibilidade.restricoes.join(', ')}`);
    }
    if (elegibilidade.observacoes) {
      parts.push(`Observacoes: ${elegibilidade.observacoes}`);
    }
    return parts.length ? parts : [];
  }
  return [];
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const service = new ProjetoService();

    const projeto = await service.buscarPorId(id);
    if (!projeto) {
      return NextResponse.json(
        { success: false, error: 'Projeto nao encontrado' },
        { status: 404 }
      );
    }

    if (!projeto.edital) {
      return NextResponse.json(
        { success: false, error: 'Edital associado nao encontrado' },
        { status: 400 }
      );
    }

    const analise = (projeto.edital as any).analiseIA;
    if (!analise) {
      return NextResponse.json(
        { success: false, error: 'Edital nao possui analise. Execute a analise primeiro.' },
        { status: 400 }
      );
    }

    const editalData = projeto.edital as any;
    const editalContext: EditalContext = {
      titulo: editalData.titulo || '',
      orgao: editalData.orgao || '',
      valor: editalData.valor ? Number(editalData.valor) : undefined,
      valorMax: editalData.valorMax ? Number(editalData.valorMax) : undefined,
      prazoMeses: editalData.prazoMeses ? Number(editalData.prazoMeses) : undefined,
      objetivo: analise.objetivo || '',
      criteriosAvaliacao: normalizeToStringArray(analise.criteriosAvaliacao),
      itensFinanciaveis: normalizeToStringArray(analise.itensFinanciaveis),
      elegibilidade: normalizeElegibilidade(analise.elegibilidade),
      areasTematicas: editalData.areasTematicas ? JSON.parse(editalData.areasTematicas) : undefined,
    };

    const writer = new ProposalWriter('mini');

    const proposalUser = {
      titulo: projeto.titulo,
      descricao: projeto.descricao || '',
      areaAtuacao: projeto.areaAtuacao || undefined,
      propostaUsuario: projeto.propostaUsuario || projeto.descricao || '',
    };

    const resultado = await writer.gerarPropostaCompleta(editalContext, proposalUser);

    const atualizacao = {
      resumoExecutivo: resultado.resumoExecutivo,
      justificativa: resultado.justificativa,
      objetivos: resultado.objetivos,
      metodologia: resultado.metodologia,
      resultadosEsperados: resultado.resultadosEsperados,
      cronograma: resultado.cronograma,
      orcamentoDetalhado: resultado.orcamentoDetalhado,
      valorSolicitado: resultado.valorSolicitado,
      prazoMeses: resultado.prazoMeses,
      equipe: resultado.equipe,
      criteriosAtendidos: resultado.criteriosAtendidos,
      criteriosPendentes: resultado.criteriosPendentes,
      scoreCompliance: resultado.scoreCompliance,
      status: 'gerado',
      versao: (projeto.versao || 1) + 1,
    };

    const projetoAtualizado = await service.atualizar(id, atualizacao);

    return NextResponse.json({
      success: true,
      data: {
        projeto: projetoAtualizado,
        analise: {
          criteriosAtendidos: resultado.criteriosAtendidos,
          criteriosPendentes: resultado.criteriosPendentes,
          scoreCompliance: resultado.scoreCompliance,
        },
      },
    });
  } catch (error: any) {
    console.error('Erro ao gerar proposta:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno' },
      { status: 500 }
    );
  }
}