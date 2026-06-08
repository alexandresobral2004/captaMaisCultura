import { NextRequest, NextResponse } from 'next/server';
import { atualizarProjetoCientificoSchema } from '@/lib/analise-cientifica/schema';
import { projetos } from '@/lib/analise-cientifica/db-mock';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const projeto = projetos.get(params.id);

  if (!projeto) {
    return NextResponse.json({
      success: false,
      error: 'Projeto não encontrado',
    }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    data: projeto,
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projeto = projetos.get(params.id);

    if (!projeto) {
      return NextResponse.json({
        success: false,
        error: 'Projeto não encontrado',
      }, { status: 404 });
    }

    const body = await request.json();
    const validado = atualizarProjetoCientificoSchema.parse(body);

    const projetoAtualizado = {
      ...projeto,
      ...validado,
      dataAtualizacao: new Date().toISOString(),
      versao: projeto.versao + 1,
    };

    projetos.set(params.id, projetoAtualizado);

    return NextResponse.json({
      success: true,
      data: projetoAtualizado,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Erro ao atualizar projeto',
    }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const projeto = projetos.get(params.id);

  if (!projeto) {
    return NextResponse.json({
      success: false,
      error: 'Projeto não encontrado',
    }, { status: 404 });
  }

  projetos.delete(params.id);

  return NextResponse.json({
    success: true,
    message: 'Projeto deletado com sucesso',
  });
}
