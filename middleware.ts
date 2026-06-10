import { NextRequest, NextResponse } from 'next/server';
import { obterUsuarioLogado } from '@/lib/api/auth';

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
  const tokenEsperado = process.env.SCAN_TOKEN;
  if (!tokenEsperado) {
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ ERRO DE CONFIGURAÇÃO: SCAN_TOKEN não definido no ambiente em produção.');
      return false;
    }
    // Fallback apenas para desenvolvimento
    const fallback = 'capta-mais-scan-token-secret-2026';
    return (
      request.headers.get('Authorization') === `Bearer ${fallback}` ||
      request.headers.get('X-Scan-Token') === fallback ||
      new URL(request.url).searchParams.get('token') === fallback
    );
  }

  // 1. Verificar Authorization Header (Bearer Token)
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    if (token === tokenEsperado) return true;
  }

  // 2. Verificar X-Scan-Token Header
  const xScanToken = request.headers.get('X-Scan-Token');
  if (xScanToken && xScanToken === tokenEsperado) return true;

  // 3. Verificar token no query string (fallback)
  const tokenQuery = new URL(request.url).searchParams.get('token');
  if (tokenQuery && tokenQuery === tokenEsperado) return true;

  return false;
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

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
  runtime: 'nodejs',
};
