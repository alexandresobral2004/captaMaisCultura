import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { loadWhitelist, clearLoadersCache } from '@/lib/scraper/filtros/loaders';
import { WhitelistSchema } from '@/lib/scraper/filtros/types';

const WHITELIST_PATH = path.join(process.cwd(), 'data', 'filtros', 'whitelist-ti.json');

const CategoriaEnum = z.enum(['tecnologia', 'contexto_institucional', 'contexto_geral']);

const BodySchema = z.object({
  categoria: CategoriaEnum,
  termo: z.string().min(1, 'Termo não pode ser vazio').max(200),
});

function salvarWhitelist(data: object): void {
  fs.writeFileSync(WHITELIST_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

/** PUT — adiciona um termo a uma categoria */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = BodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((e) => e.message).join(', ') },
        { status: 400 }
      );
    }

    const { categoria, termo } = parsed.data;
    const termoNorm = termo.trim().toLowerCase();

    clearLoadersCache();
    const whitelist = loadWhitelist();

    // Verifica duplicata
    if (whitelist[categoria].map((t) => t.toLowerCase()).includes(termoNorm)) {
      return NextResponse.json(
        { error: `Termo "${termo}" já existe em ${categoria}` },
        { status: 409 }
      );
    }

    // Insere em ordem alfabética
    const lista = [...whitelist[categoria], termoNorm].sort((a, b) =>
      a.localeCompare(b, 'pt-BR')
    );

    const novaWhitelist = { ...whitelist, [categoria]: lista };

    // Valida o resultado antes de salvar
    const validacao = WhitelistSchema.safeParse(novaWhitelist);
    if (!validacao.success) {
      return NextResponse.json({ error: 'Dados inválidos após modificação' }, { status: 500 });
    }

    salvarWhitelist(novaWhitelist);
    clearLoadersCache();

    return NextResponse.json({
      success: true,
      total: lista.length,
      message: `Termo "${termoNorm}" adicionado em ${categoria}`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: `Erro interno: ${error.message}` },
      { status: 500 }
    );
  }
}

/** DELETE — remove um termo de uma categoria */
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = BodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((e) => e.message).join(', ') },
        { status: 400 }
      );
    }

    const { categoria, termo } = parsed.data;
    const termoNorm = termo.trim().toLowerCase();

    clearLoadersCache();
    const whitelist = loadWhitelist();

    const listaAnterior = whitelist[categoria];
    const novaLista = listaAnterior.filter((t) => t.toLowerCase() !== termoNorm);

    if (novaLista.length === listaAnterior.length) {
      return NextResponse.json(
        { error: `Termo "${termo}" não encontrado em ${categoria}` },
        { status: 404 }
      );
    }

    const novaWhitelist = { ...whitelist, [categoria]: novaLista };

    const validacao = WhitelistSchema.safeParse(novaWhitelist);
    if (!validacao.success) {
      return NextResponse.json({ error: 'Dados inválidos após remoção' }, { status: 500 });
    }

    salvarWhitelist(novaWhitelist);
    clearLoadersCache();

    return NextResponse.json({
      success: true,
      total: novaLista.length,
      message: `Termo "${termoNorm}" removido de ${categoria}`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: `Erro interno: ${error.message}` },
      { status: 500 }
    );
  }
}
