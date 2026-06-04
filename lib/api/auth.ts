import { NextRequest, NextResponse } from 'next/server';

export interface UsuarioLogado {
  id: string;
  nome: string;
  email: string;
  role: 'admin' | 'editor' | 'leitor';
  status: string;
}

/**
 * Extrai os dados do usuário logado do cookie
 */
export function obterUsuarioLogado(request: NextRequest): UsuarioLogado | null {
  const cookie = request.cookies.get('usuario_logado');
  
  if (!cookie?.value) {
    return null;
  }

  try {
    const usuario = JSON.parse(cookie.value) as UsuarioLogado;
    return usuario;
  } catch {
    return null;
  }
}

/**
 * Verifica se o usuário é admin. Retorna null se não for.
 */
export function verificarAdmin(request: NextRequest): { ok: true; usuario: UsuarioLogado } | { ok: false; response: NextResponse } {
  const usuario = obterUsuarioLogado(request);

  if (!usuario) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      ),
    };
  }

  if (usuario.role !== 'admin') {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Acesso restrito a administradores' },
        { status: 403 }
      ),
    };
  }

  return { ok: true, usuario };
}