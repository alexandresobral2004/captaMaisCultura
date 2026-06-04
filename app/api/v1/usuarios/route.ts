import { NextRequest, NextResponse } from 'next/server';
import { UsuarioService } from '@/lib/database/services/usuario.service';

export const dynamic = 'force-dynamic';

const service = new UsuarioService();

export async function GET() {
  try {
    const usuarios = await service.listar();
    return NextResponse.json(usuarios);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao listar usuarios' },
      { status: 500 }
    );
  }
}
