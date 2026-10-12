import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Encerra a sessão apagando o cookie assinado. */
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set('usuario_logado', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  return response;
}
