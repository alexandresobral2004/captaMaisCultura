import { NextRequest, NextResponse } from 'next/server';
import { UsuarioService } from '@/lib/database/services/usuario.service';

const service = new UsuarioService();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const usuario = await service.buscarPorId(params.id);
    if (!usuario) {
      return NextResponse.json(
        { error: 'Usuario nao encontrado' },
        { status: 404 }
      );
    }
    return NextResponse.json(usuario);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar usuario' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const usuario = await service.atualizar(params.id, body);
    return NextResponse.json(usuario);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar usuario' },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const resultado = await service.deletar(params.id);
    return NextResponse.json(resultado);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao deletar usuario' },
      { status: 400 }
    );
  }
}
