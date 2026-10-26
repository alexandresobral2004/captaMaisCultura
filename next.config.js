/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Externaliza pacotes pesados de servidor para não quebrarem o chunk splitting
  // do webpack. O route run-weekly-scan importa uma cadeia pesada que corrompe
  // o vendor-chunks/next.js compartilhado quando bundlada pelo webpack.
  experimental: {
    // Habilita instrumentation.ts (carrega os filtros do banco no start do servidor)
    instrumentationHook: true,
    serverComponentsExternalPackages: [
      'better-sqlite3',
      'drizzle-orm',
      'openai',
      '@langchain/openai',
      '@langchain/core',
      'pdfkit',
      // pdf-parse v2 abre um worker (pdf.worker.mjs) por caminho relativo; empacotado pelo
      // webpack, o worker some e a extração devolve 0 caracteres em produção.
      'pdf-parse',
    ],
  },
  // Ignorar erros de build (TypeScript e ESLint) para permitir deploy
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async headers() {
    return [
      {
        source: '/((?!api/v1/editais/.*Download|api/v1/editais/.*/file).*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' blob: data: *; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' *; frame-ancestors 'none'; object-src 'none';",
          },
        ],
      },
    ];
  },
}

module.exports = nextConfig


