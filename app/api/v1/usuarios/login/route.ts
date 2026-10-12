import { NextRequest, NextResponse } from 'next/server';
import { UsuarioService } from '@/lib/database/services/usuario.service';
import { assinarToken, SESSAO_DURACAO_SEGUNDOS } from '@/lib/api/auth';
import { LoginUsuarioSchema } from '@/lib/api/validators';
import { rateLimit, rateLimitPorChave, handleRateLimitResponse } from '@/lib/api/middleware/rate-limit';
import { ZodError } from 'zod';

const service = new UsuarioService();

export async function POST(request: NextRequest) {
  let requestEmail = 'desconhecido';
  try {
    // Aplicar Rate Limit (máximo 5 tentativas de login por IP a cada 15 minutos)
    const limiter = rateLimit(request, 'login', { limit: 5, windowMs: 15 * 60 * 1000 });
    if (!limiter.success) {
      console.warn('⚠️ [LOGIN] Rate limit atingido para uma tentativa de login.');
      return handleRateLimitResponse(limiter.resetTime);
    }

    const body = await request.json();
    requestEmail = body?.email || 'não informado';
    console.log(`🔑 [LOGIN] Tentativa de login iniciada para o e-mail: "${requestEmail}"`);
    
    // Validar input usando schema Zod
    console.log('📝 [LOGIN] Validando dados de entrada com Zod...');
    const validatedData = LoginUsuarioSchema.parse(body);

    // Limite por e-mail: não pode ser contornado trocando o IP/headers
    const limiterEmail = rateLimitPorChave(validatedData.email, 'login-email', { limit: 5, windowMs: 15 * 60 * 1000 });
    if (!limiterEmail.success) {
      return handleRateLimitResponse(limiterEmail.resetTime);
    }

    console.log('💾 [LOGIN] Autenticando credenciais no banco de dados...');
    const usuario = await service.login(validatedData);
    console.log(`✅ [LOGIN] Autenticação bem-sucedida para o usuário: "${usuario.email}" (Role: ${usuario.role})`);

    const response = NextResponse.json(usuario);

    console.log('🔒 [LOGIN] Gerando cookie de sessão criptografado/assinado...');
    const token = await assinarToken(
      JSON.stringify({ ...usuario, exp: Math.floor(Date.now() / 1000) + SESSAO_DURACAO_SEGUNDOS })
    );

    response.cookies.set('usuario_logado', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSAO_DURACAO_SEGUNDOS,
      path: '/',
    });
    console.log('🍪 [LOGIN] Cookie usuario_logado definido com sucesso.');

    return response;
  } catch (error: any) {
    if (error instanceof ZodError) {
      const messages = error.issues.map((e: any) => e.message).join(', ');
      console.error(`❌ [LOGIN] Erro de validação Zod para o e-mail "${requestEmail}":`, messages);
      return NextResponse.json(
        { error: messages },
        { status: 400 }
      );
    }
    console.error(`❌ [LOGIN] Falha no login para o e-mail "${requestEmail}":`, error.message || error);
    // Mensagem genérica: não revela se o e-mail existe ou se a conta está desativada
    return NextResponse.json(
      { error: 'Email ou senha invalidos' },
      { status: 401 }
    );
  }
}
