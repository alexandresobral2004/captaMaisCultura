import { NextRequest, NextResponse } from 'next/server';
import { ProjetoService } from '@/lib/database/services/projeto.service';
import { z } from 'zod';

const criarProjetoSchema = z.object({
  titulo: z.string().min(1),
  editalId: z.string().min(1),
  descricao: z.string().optional(),
  areaAtuacao: z.string().optional(),
  propostaUsuario: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const service = new ProjetoService();
    const { searchParams } = new URL(request.url);

    const query = {
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
      status: searchParams.get('status') || undefined,
      editalId: searchParams.get('editalId') || undefined,
      search: searchParams.get('search') || undefined,
      sortBy: searchParams.get('sortBy') || undefined,
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
    };

    const result = await service.listar(query);

    return NextResponse.json({
      success: true,
      data: result.data,
      total: result.total,
    });
  } catch (error: any) {
    console.error('Erro ao listar projetos:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = criarProjetoSchema.parse(body);

    const service = new ProjetoService();

    const id = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const projeto = await service.criar({
      id,
      titulo: validated.titulo,
      editalId: validated.editalId,
      descricao: validated.descricao,
      areaAtuacao: validated.areaAtuacao,
      propostaUsuario: validated.propostaUsuario,
      status: 'rascunho',
      versao: 1,
    });

    return NextResponse.json({
      success: true,
      data: projeto,
    }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Dados invalidos', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Erro ao criar projeto:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno' },
      { status: 500 }
    );
  }
}