import { NextResponse } from 'next/server';
import { loadWhitelist, loadBlacklist, clearLoadersCache } from '@/lib/scraper/filtros/loaders';

export async function GET() {
  try {
    // Força reload para garantir dados frescos na UI
    clearLoadersCache();
    const whitelist = loadWhitelist();
    const blacklist = loadBlacklist();

    const totalWhitelist =
      whitelist.tecnologia.length +
      whitelist.contexto_institucional.length +
      whitelist.contexto_geral.length;

    const totalBlacklist = blacklist.blacklist.length;

    const totalComExcecoes = Object.keys(blacklist.excecoes).length;
    const totalSemExcecoes = totalBlacklist - totalComExcecoes;

    const stats = {
      totalWhitelist,
      totalBlacklist,
      totalComExcecoes,
      totalSemExcecoes,
      coberturaPorCategoria: {
        tecnologia: whitelist.tecnologia.length,
        contexto_institucional: whitelist.contexto_institucional.length,
        contexto_geral: whitelist.contexto_geral.length,
      },
    };

    return NextResponse.json({ whitelist, blacklist, stats });
  } catch (error: any) {
    return NextResponse.json(
      { error: `Falha ao carregar filtros: ${error.message}` },
      { status: 500 }
    );
  }
}
