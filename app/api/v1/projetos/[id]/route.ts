import { NextRequest, NextResponse } from 'next/server';
import { ProjetoService } from '@/lib/database/services/projeto.service';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const atualizarProjetoSchema = z.object({
  titulo: z.string().min(1).optional(),
  descricao: z.string().optional(),
  areaAtuacao: z.string().optional(),
  propostaUsuario: z.string().optional(),
  resumoExecutivo: z.string().optional(),
  justificativa: z.string().optional(),
  objetivos: z.string().optional(),
  metodologia: z.string().optional(),
  resultadosEsperados: z.string().optional(),
  cronograma: z.string().optional(),
  orcamentoDetalhado: z.string().optional(),
  valorSolicitado: z.number().optional(),
  prazoMeses: z.number().optional(),
  equipe: z.array(z.any()).optional(),
  criteriosAtendidos: z.array(z.string()).optional(),
  criteriosPendentes: z.array(z.string()).optional(),
  scoreCompliance: z.number().optional(),
  status: z.string().optional(),
});

export async function GET(request: NextRequest, { params }: RouteParams) {
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

    return NextResponse.json({
      success: true,
      data: projeto,
    });
  } catch (error: any) {
    console.error('Erro ao buscar projeto:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validated = atualizarProjetoSchema.parse(body);

    const service = new ProjetoService();
    const projeto = await service.atualizar(id, validated);

    return NextResponse.json({
      success: true,
      data: projeto,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Dados invalidos', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Erro ao atualizar projeto:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const service = new ProjetoService();

    await service.deletar(id);

    return NextResponse.json({
      success: true,
      message: 'Projeto deletado com sucesso',
    });
  } catch (error: any) {
    console.error('Erro ao deletar projeto:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno' },
      { status: 500 }
    );
  }
}