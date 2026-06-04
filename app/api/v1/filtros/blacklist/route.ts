import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { loadBlacklist, clearLoadersCache } from '@/lib/scraper/filtros/loaders';
import { BlacklistSchema } from '@/lib/scraper/filtros/types';

const BLACKLIST_PATH = path.join(process.cwd(), 'data', 'filtros', 'blacklist-ti.json');

const AddTermoSchema = z.object({
  tipo: z.literal('termo'),
  termo: z.string().min(1).max(200),
});

const AddExcecaoSchema = z.object({
  tipo: z.literal('excecao'),
  termo: z.string().min(1).max(200),
  excecao: z.string().min(1).max(200),
});

const RemoveTermoSchema = z.object({
  tipo: z.literal('termo'),
  termo: z.string().min(1).max(200),
});

const RemoveExcecaoSchema = z.object({
  tipo: z.literal('excecao'),
  termo: z.string().min(1).max(200),
  excecao: z.string().min(1).max(200),
});

const PutBodySchema = z.discriminatedUnion('tipo', [AddTermoSchema, AddExcecaoSchema]);
const DeleteBodySchema = z.discriminatedUnion('tipo', [RemoveTermoSchema, RemoveExcecaoSchema]);

function salvarBlacklist(data: object): void {
  fs.writeFileSync(BLACKLIST_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

/** PUT — adiciona um termo ou uma exceção */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = PutBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((e) => e.message).join(', ') },
        { status: 400 }
      );
    }

    clearLoadersCache();
    const blacklist = loadBlacklist();

    if (parsed.data.tipo === 'termo') {
      const termoNorm = parsed.data.termo.trim().toLowerCase();

      if (blacklist.blacklist.map((t) => t.toLowerCase()).includes(termoNorm)) {
        return NextResponse.json(
          { error: `Termo "${termoNorm}" já existe na blacklist` },
          { status: 409 }
        );
      }

      const novaLista = [...blacklist.blacklist, termoNorm].sort((a, b) =>
        a.localeCompare(b, 'pt-BR')
      );

      const novaBlacklist = { ...blacklist, blacklist: novaLista };
      const validacao = BlacklistSchema.safeParse(novaBlacklist);
      if (!validacao.success) {
        return NextResponse.json({ error: 'Dados inválidos após adição' }, { status: 500 });
      }

      salvarBlacklist(novaBlacklist);
      clearLoadersCache();

      return NextResponse.json({
        success: true,
        message: `Termo "${termoNorm}" adicionado à blacklist`,
      });
    }

    // tipo === 'excecao'
    const { termo, excecao } = parsed.data;
    const termoNorm = termo.trim().toLowerCase();
    const excecaoNorm = excecao.trim().toLowerCase();

    if (!blacklist.blacklist.map((t) => t.toLowerCase()).includes(termoNorm)) {
      return NextResponse.json(
        { error: `Termo "${termoNorm}" não existe na blacklist` },
        { status: 404 }
      );
    }

    const excecoesAtuais = blacklist.excecoes[termoNorm] || [];
    if (excecoesAtuais.map((e) => e.toLowerCase()).includes(excecaoNorm)) {
      return NextResponse.json(
        { error: `Exceção "${excecaoNorm}" já existe para "${termoNorm}"` },
        { status: 409 }
      );
    }

    const novasExcecoes = {
      ...blacklist.excecoes,
      [termoNorm]: [...excecoesAtuais, excecaoNorm].sort((a, b) =>
        a.localeCompare(b, 'pt-BR')
      ),
    };

    const novaBlacklist = { ...blacklist, excecoes: novasExcecoes };
    const validacao = BlacklistSchema.safeParse(novaBlacklist);
    if (!validacao.success) {
      return NextResponse.json({ error: 'Dados inválidos após adição de exceção' }, { status: 500 });
    }

    salvarBlacklist(novaBlacklist);
    clearLoadersCache();

    return NextResponse.json({
      success: true,
      message: `Exceção "${excecaoNorm}" adicionada ao termo "${termoNorm}"`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: `Erro interno: ${error.message}` }, { status: 500 });
  }
}

/** DELETE — remove um termo (e suas exceções) ou apenas uma exceção */
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = DeleteBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((e) => e.message).join(', ') },
        { status: 400 }
      );
    }

    clearLoadersCache();
    const blacklist = loadBlacklist();

    if (parsed.data.tipo === 'termo') {
      const termoNorm = parsed.data.termo.trim().toLowerCase();

      const novaLista = blacklist.blacklist.filter((t) => t.toLowerCase() !== termoNorm);
      if (novaLista.length === blacklist.blacklist.length) {
        return NextResponse.json(
          { error: `Termo "${termoNorm}" não encontrado` },
          { status: 404 }
        );
      }

      // Remove também as exceções associadas
      const novasExcecoes = { ...blacklist.excecoes };
      delete novasExcecoes[termoNorm];

      const novaBlacklist = { blacklist: novaLista, excecoes: novasExcecoes };
      const validacao = BlacklistSchema.safeParse(novaBlacklist);
      if (!validacao.success) {
        return NextResponse.json({ error: 'Dados inválidos após remoção' }, { status: 500 });
      }

      salvarBlacklist(novaBlacklist);
      clearLoadersCache();

      return NextResponse.json({
        success: true,
        message: `Termo "${termoNorm}" e suas exceções foram removidos`,
      });
    }

    // tipo === 'excecao'
    const { termo, excecao } = parsed.data;
    const termoNorm = termo.trim().toLowerCase();
    const excecaoNorm = excecao.trim().toLowerCase();

    const excecoesAtuais = blacklist.excecoes[termoNorm];
    if (!excecoesAtuais) {
      return NextResponse.json(
        { error: `Nenhuma exceção encontrada para "${termoNorm}"` },
        { status: 404 }
      );
    }

    const novasExcecoesLista = excecoesAtuais.filter((e) => e.toLowerCase() !== excecaoNorm);
    if (novasExcecoesLista.length === excecoesAtuais.length) {
      return NextResponse.json(
        { error: `Exceção "${excecaoNorm}" não encontrada para "${termoNorm}"` },
        { status: 404 }
      );
    }

    const novasExcecoes = { ...blacklist.excecoes };
    if (novasExcecoesLista.length === 0) {
      delete novasExcecoes[termoNorm];
    } else {
      novasExcecoes[termoNorm] = novasExcecoesLista;
    }

    const novaBlacklist = { ...blacklist, excecoes: novasExcecoes };
    const validacao = BlacklistSchema.safeParse(novaBlacklist);
    if (!validacao.success) {
      return NextResponse.json({ error: 'Dados inválidos após remoção de exceção' }, { status: 500 });
    }

    salvarBlacklist(novaBlacklist);
    clearLoadersCache();

    return NextResponse.json({
      success: true,
      message: `Exceção "${excecaoNorm}" removida de "${termoNorm}"`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: `Erro interno: ${error.message}` }, { status: 500 });
  }
}
