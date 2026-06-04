import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validarWhitelistTI } from '@/lib/filtros-ti/whitelist';
import { analisarBlacklist } from '@/lib/scraper/filtros/blacklist-engine';
import { clearLoadersCache } from '@/lib/scraper/filtros/loaders';

const BodySchema = z.object({
  titulo: z.string().min(1, 'Título é obrigatório').max(500),
  descricao: z.string().max(5000).default(''),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = BodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((e) => e.message).join(', ') },
        { status: 400 }
      );
    }

    const { titulo, descricao } = parsed.data;

    // Garante que os filtros carregam a versão mais recente dos JSONs
    clearLoadersCache();

    // Etapa 1 — Whitelist
    const whitelistResult = validarWhitelistTI(titulo, descricao);

    // Etapa 2 — Blacklist
    const blacklistResult = analisarBlacklist(titulo, descricao);

    // Decisão final (sem chamar IA)
    let status: 'pendente' | 'descartado' | 'duvida';
    let etapaQueDescartou: 'whitelist' | 'blacklist' | null = null;
    let mensagem: string;

    if (!whitelistResult.válido) {
      status = 'descartado';
      etapaQueDescartou = 'whitelist';
      mensagem = 'Nenhum termo TI identificado — edital seria descartado na Etapa 1';
    } else if (blacklistResult.recomendacao === 'bloquear') {
      status = 'descartado';
      etapaQueDescartou = 'blacklist';
      mensagem = `Score negativo ${blacklistResult.scoreNegativo} excede o limite (45) — edital seria bloqueado na Etapa 2`;
    } else {
      status = 'pendente';
      mensagem =
        blacklistResult.scoreNegativo > 0
          ? `Whitelist ✅ | Blacklist ⚠️ ${blacklistResult.recomendacao} (score -${blacklistResult.scoreNegativo}) | Seguiria para classificação pela IA`
          : 'Whitelist ✅ | Blacklist limpa | Seguiria para classificação pela IA';
    }

    return NextResponse.json({
      whitelist: {
        válido: whitelistResult.válido,
        confidence: whitelistResult.confidence,
        termosEncontrados: whitelistResult.termosBranco,
        categoria: whitelistResult.categoria,
      },
      blacklist: {
        scoreNegativo: blacklistResult.scoreNegativo,
        termosEncontrados: blacklistResult.termosEncontrados,
        severidade: blacklistResult.severidade,
        recomendacao: blacklistResult.recomendacao,
        motivos: blacklistResult.motivos,
      },
      decisao: {
        status,
        etapaQueDescartou,
        mensagem,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: `Erro interno na simulação: ${error.message}` },
      { status: 500 }
    );
  }
}
