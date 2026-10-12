import { NextRequest, NextResponse } from 'next/server';
import { ProjetoService } from '@/lib/database/services/projeto.service';
import { apiKeyConfigurada } from '@/lib/ai/client';
import { montarContextoGeracao, ProponenteAusenteError } from '@/lib/projetos/contexto-geracao';
import { aprimorarSecao } from '@/lib/projetos/gerador-projeto';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Reescreve uma seção usando o edital, os critérios e as demais seções do projeto.
 * Não grava: devolve o texto novo e a tela decide aplicar (e permite desfazer).
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { secaoChave, secaoTitulo, conteudoAtual, pedido, pendencias } = await request.json();

    if (!secaoChave || !secaoTitulo) {
      return NextResponse.json({ success: false, error: 'Informe a seção a aprimorar.' }, { status: 400 });
    }
    if (!apiKeyConfigurada()) {
      return NextResponse.json({ success: false, error: 'Chave da IA não configurada no servidor.' }, { status: 500 });
    }

    const projeto = await new ProjetoService().buscarPorId(id);
    if (!projeto) {
      return NextResponse.json({ success: false, error: 'Projeto não encontrado.' }, { status: 404 });
    }
    if (!(projeto.edital as any)?.analiseIA) {
      return NextResponse.json({ success: false, error: 'O edital ainda não foi analisado. Execute a análise primeiro.' }, { status: 400 });
    }

    const ctx = await montarContextoGeracao(projeto);
    const todas = ((projeto.secoesDinamicas as any[]) || []);
    const secao = { id: secaoChave, chave: secaoChave, titulo: secaoTitulo, conteudo: conteudoAtual || '' };
    const outras = todas.filter(s => s.chave !== secaoChave);

    const { conteudoNovo, avisos } = await aprimorarSecao(ctx, secao, outras, {
      pedido: typeof pedido === 'string' ? pedido.slice(0, 500) : undefined,
      pendencias: Array.isArray(pendencias) ? pendencias.filter((p: unknown) => typeof p === 'string').slice(0, 10) : undefined,
    });

    return NextResponse.json({ success: true, conteudoNovo, avisos });
  } catch (error: any) {
    if (error instanceof ProponenteAusenteError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    console.error('Erro ao aprimorar seção:', error);
    return NextResponse.json({ success: false, error: error.message || 'Erro interno do servidor' }, { status: 500 });
  }
}
