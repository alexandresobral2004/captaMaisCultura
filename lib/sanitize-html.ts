import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitiza HTML vindo de IA, scraping ou usuários antes de renderizar.
 * Remove scripts, handlers inline (onerror etc.) e URLs javascript:.
 */
export function sanitizarHtml(html: string | null | undefined): string {
  return DOMPurify.sanitize(html ?? '', { USE_PROFILES: { html: true } });
}
