import { NextRequest, NextResponse } from 'next/server';
import { UsuarioService } from '@/lib/database/services/usuario.service';

const service = new UsuarioService();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nome, email, password, confirmarPassword } = body;

    if (!nome || !email || !password || !confirmarPassword) {
      return NextResponse.json(
        { error: 'Todos os campos sao obrigatorios' },
        { status: 400 }
      );
    }

    const usuario = await service.cadastrar({ nome, email, password, confirmarPassword });

    return NextResponse.json(usuario, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao cadastrar usuario' },
      { status: 400 }
    );
  }
}
