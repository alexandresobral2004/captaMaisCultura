import { NextRequest, NextResponse } from 'next/server';
import { UsuarioService } from '@/lib/database/services/usuario.service';
import { CadastroUsuarioSchema } from '@/lib/api/validators';
import { rateLimit, handleRateLimitResponse } from '@/lib/api/middleware/rate-limit';
import { ZodError } from 'zod';

const service = new UsuarioService();

export async function POST(request: NextRequest) {
  try {
    // Aplicar Rate Limit (máximo 3 cadastros de usuário por IP a cada 1 hora)
    const limiter = rateLimit(request, 'cadastrar', { limit: 3, windowMs: 60 * 60 * 1000 });
    if (!limiter.success) {
      return handleRateLimitResponse(limiter.resetTime);
    }

    const body = await request.json();
    
    // Validar input usando schema Zod
    const validatedData = CadastroUsuarioSchema.parse(body);

    const usuario = await service.cadastrar(validatedData);

    return NextResponse.json(usuario, { status: 201 });
  } catch (error: any) {
    // Se for um erro do Zod, formatar a mensagem de erro amigável
    if (error instanceof ZodError) {
      const messages = error.issues.map((e: any) => e.message).join(', ');
      return NextResponse.json(
        { error: messages },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || 'Erro ao cadastrar usuario' },
      { status: 400 }
    );
  }
}
