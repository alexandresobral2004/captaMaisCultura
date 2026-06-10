import { NextRequest, NextResponse } from 'next/server';

export interface UsuarioLogado {
  id: string;
  nome: string;
  email: string;
  role: 'admin' | 'editor' | 'leitor';
  status: string;
}

// Chave para assinatura
const SESSION_SECRET = process.env.SESSION_SECRET || 'capta-mais-cultura-secret-fallback-key-2026-development-only';

/**
 * Converte string para ArrayBuffer
 */
function encode(str: string): ArrayBuffer {
  return new TextEncoder().encode(str).buffer;
}

/**
 * Converte ArrayBuffer para base64url
 */
function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Converte base64url para ArrayBuffer
 */
function base64UrlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Assina um payload gerando uma string no formato payloadBase64.assinatura (base64url)
 */
export async function assinarToken(payload: string): Promise<string> {
  const payloadBase64 = bufferToBase64Url(encode(payload));
  const key = await crypto.subtle.importKey(
    'raw',
    encode(SESSION_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encode(payloadBase64));
  const assinatura = bufferToBase64Url(signature);
  return `${payloadBase64}.${assinatura}`;
}

/**
 * Verifica a assinatura de um token e extrai o payload original
 */
export async function verificarToken(token: string): Promise<string | null> {
  const partes = token.split('.');
  if (partes.length !== 2) return null;

  const [payloadBase64, assinaturaFornecida] = partes;

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      encode(SESSION_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    );
    
    const assinaturaEsperadaBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encode(payloadBase64)
    );
    const assinaturaEsperada = bufferToBase64Url(assinaturaEsperadaBuffer);

    if (assinaturaFornecida !== assinaturaEsperada) {
      return null;
    }

    try {
      return new TextDecoder().decode(base64UrlToBuffer(payloadBase64));
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

/**
 * Extrai os dados do usuário logado do cookie assinado
 */
export async function obterUsuarioLogado(request: NextRequest): Promise<UsuarioLogado | null> {
  const cookie = request.cookies.get('usuario_logado');
  
  if (!cookie?.value) {
    return null;
  }

  try {
    const payloadOriginal = await verificarToken(cookie.value);
    if (!payloadOriginal) {
      return null;
    }
    const usuario = JSON.parse(payloadOriginal) as UsuarioLogado;
    return usuario;
  } catch {
    return null;
  }
}

/**
 * Verifica se o usuário é admin. Retorna null se não for.
 */
export async function verificarAdmin(request: NextRequest): Promise<{ ok: true; usuario: UsuarioLogado } | { ok: false; response: NextResponse }> {
  const usuario = await obterUsuarioLogado(request);

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
