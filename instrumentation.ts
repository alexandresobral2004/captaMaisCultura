/**
 * Executado uma vez quando o servidor Node sobe (Next.js 14, com experimental.instrumentationHook).
 * Carrega os filtros de TI do banco para a memória, que é o que os loaders síncronos leem.
 */
export async function register() {
  // Import só dentro deste if: o Next remove o ramo do runtime edge na compilação.
  // Sem isso, o build tenta resolver fs/path/better-sqlite3 no edge e falha.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { sincronizarFiltros } = await import('./lib/scraper/filtros/loaders');
      await sincronizarFiltros();
      console.log('✅ [Filtros] Carregados do banco (configuracoes)');
    } catch (erro) {
      // Sem banco no start, os loaders caem nos arquivos do repositório
      console.error('⚠️ [Filtros] Falha ao sincronizar com o banco; usando arquivos do repositório:', erro);
    }
  }
}
