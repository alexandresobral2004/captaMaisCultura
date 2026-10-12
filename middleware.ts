import { NextRequest, NextResponse } from 'next/server';
import { obterUsuarioLogado } from '@/lib/api/auth';
import { scanTokenValido, extrairScanTokenDosHeaders } from '@/lib/api/scan-token';

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
  '/api/v1/scraper/logs/stream',
];

/**
 * Verifica se a requisição tem um token válido para rotas de script
 */
function verificarTokenScript(request: NextRequest): boolean {
  return scanTokenValido(extrairScanTokenDosHeaders(request.headers));
}

export async function middleware(request: NextRequest) {
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
    
    // 3. Se não tem token válido, verificar cookie assinado
    const usuario = await obterUsuarioLogado(request);
    if (usuario) {
      return NextResponse.next();
    }
    
    // Se não tem nem token nem cookie válido, negar acesso
    return NextResponse.json(
      { error: 'Não autenticado. Forneça um token válido ou faça login.' },
      { status: 401 }
    );
  }

  // Para todas as outras rotas, verificar cookie assinado
  const usuario = await obterUsuarioLogado(request);

  if (!usuario) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Nao autenticado' },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Verificar permissões para rotas restritas de admin (Configurações e Usuários)
  const isRestrictedRoute = 
    pathname.startsWith('/configuracoes') || 
    pathname.startsWith('/usuarios') || 
    (pathname.startsWith('/api/v1/') && (
      pathname.startsWith('/api/v1/usuarios') ||
      pathname.startsWith('/api/v1/filtros') ||
      pathname.startsWith('/api/v1/portais') ||
      pathname.startsWith('/api/v1/prompts')
    ));

  if (isRestrictedRoute) {
    // Permitir login público e consulta do perfil pessoal
    const isExempt = 
      pathname === '/api/v1/usuarios/login' || 
      pathname === '/api/v1/usuarios/me';

    if (!isExempt) {
      if (usuario.role !== 'admin') {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json(
            { error: 'Acesso negado: Somente administradores têm acesso.' },
            { status: 403 }
          );
        }
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }
  }

  // Perfil "leitor" é somente leitura: métodos que alteram dados exigem admin ou editor
  const metodoMutavel = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
  if (
    metodoMutavel &&
    pathname.startsWith('/api/') &&
    pathname !== '/api/v1/usuarios/me' &&
    usuario.role !== 'admin' &&
    usuario.role !== 'editor'
  ) {
    return NextResponse.json(
      { error: 'Acesso negado: perfil somente leitura.' },
      { status: 403 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
  runtime: 'nodejs',
};
