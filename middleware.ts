import { NextRequest, NextResponse } from 'next/server';

const ROTAS_PUBLICAS = [
  '/',
  '/login',
  '/api/v1/usuarios/cadastrar',
  '/api/v1/usuarios/login',
];

const ROTAS_ESTATICAS = [
  '/_next/',
  '/favicon.ico',
  '/images/',
  '/fonts/',
];

// Rotas que aceitam autenticação por token (para scripts/admin)
const ROTAS_AUTENTICACAO_TOKEN = [
  '/api/jobs/run-weekly-scan',
];

/**
 * Verifica se a requisição tem um token válido para rotas de script
 */
function verificarTokenScript(request: NextRequest): boolean {
  const url = new URL(request.url);
  
  // Verificar token no query string
  const tokenQuery = url.searchParams.get('token');
  if (tokenQuery && tokenQuery === (process.env.SCAN_TOKEN || 'capta-mais-scan-token-secret-2026')) {
    return true;
  }

  // Verificar token no body (para POST)
  // Nota: não podemos ler o body no middleware, então validaremos no endpoint
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (ROTAS_ESTATICAS.some(rota => pathname.startsWith(rota))) {
    return NextResponse.next();
  }

  if (ROTAS_PUBLICAS.includes(pathname)) {
    return NextResponse.next();
  }

  // Verificar se é uma rota que aceita token
  const aceitaToken = ROTAS_AUTENTICACAO_TOKEN.some(rota => pathname.startsWith(rota));
  
  if (aceitaToken) {
    // 1. Para POST, deixa passar para o endpoint validar no body
    if (request.method === 'POST') {
      return NextResponse.next();
    }

    // 2. Verificar autenticação por token (GET)
    if (verificarTokenScript(request)) {
      return NextResponse.next();
    }
    
    // 3. Se não tem token válido, verificar cookie
    const usuarioLogado = request.cookies.get('usuario_logado');
    if (usuarioLogado) {
      return NextResponse.next();
    }
    
    // Se não tem nem token nem cookie, negar acesso
    return NextResponse.json(
      { error: 'Não autenticado. Forneça um token válido ou faça login.' },
      { status: 401 }
    );
  }

  // Para todas as outras rotas, verificar cookie
  const usuarioLogado = request.cookies.get('usuario_logado');

  if (!usuarioLogado) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Nao autenticado' },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
