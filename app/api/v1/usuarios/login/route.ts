import { NextRequest, NextResponse } from 'next/server';
import { UsuarioService } from '@/lib/database/services/usuario.service';

const service = new UsuarioService();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email e senha sao obrigatorios' },
        { status: 400 }
      );
    }

    const usuario = await service.login({ email, password });

    const response = NextResponse.json(usuario);

    response.cookies.set('usuario_logado', JSON.stringify(usuario), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 horas
      path: '/',
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao fazer login' },
      { status: 401 }
    );
  }
}
