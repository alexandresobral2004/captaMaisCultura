import { NextRequest, NextResponse } from 'next/server';
import { ProjetoService } from '@/lib/database/services/projeto.service';
import { montarContextoGeracao, ProponenteAusenteError } from '@/lib/projetos/contexto-geracao';
import { gerarSecoes, contarPreencher } from '@/lib/projetos/gerador-projeto';
import { conferirProjeto } from '@/lib/projetos/conferencia';
import { julgarComOpenAI } from '@/lib/projetos/julgar-ia';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const corpo = await request.json().catch(() => ({}));
    const modo: 'vazias' | 'todas' = corpo?.modo === 'vazias' ? 'vazias' : 'todas';
    const service = new ProjetoService();

    const projeto = await service.buscarPorId(id);
    if (!projeto) {
      return NextResponse.json({ success: false, error: 'Projeto não encontrado.' }, { status: 404 });
    }
    if (!projeto.edital) {
      return NextResponse.json({ success: false, error: 'Edital associado não encontrado.' }, { status: 400 });
    }
    if (!(projeto.edital as any).analiseIA) {
      return NextResponse.json({ success: false, error: 'O edital ainda não foi analisado. Execute a análise primeiro.' }, { status: 400 });
    }
    const secoesAtuais = ((projeto.secoesDinamicas as any[]) || []);
    if (!secoesAtuais.length) {
      return NextResponse.json({ success: false, error: 'O projeto não tem seções para preencher.' }, { status: 400 });
    }

    const ctx = await montarContextoGeracao(projeto);
    const { secoes: geradas, avisos } = await gerarSecoes(ctx, secoesAtuais, { modo });

    const secoesNovas = secoesAtuais.map((s: any) => ({ ...s, conteudo: geradas[s.chave] ?? s.conteudo ?? '' }));
    const atualizacao: Record<string, any> = {
      secoesDinamicas: JSON.stringify(secoesNovas),
      status: 'gerado',
      versao: (projeto.versao || 1) + 1,
    };

    let projetoAtualizado = await service.atualizar(id, atualizacao);

    // Conferência real contra o edital (substitui a "nota" que a IA estimava sozinha)
    let conferencia = null;
    try {
      conferencia = await conferirProjeto(projetoAtualizado, julgarComOpenAI);
      projetoAtualizado = await service.atualizar(id, {
        criteriosAtendidos: conferencia.criterios.filter(c => c.situacao === 'atendido').map(c => c.criterio),
        criteriosPendentes: conferencia.criterios.filter(c => c.situacao !== 'atendido').map(c => `${c.criterio}${c.observacao ? `: ${c.observacao}` : ''}`),
        scoreCompliance: conferencia.nota,
      });
    } catch (e) {
      console.warn('Conferência pós-geração falhou:', e);
    }

    return NextResponse.json({
      success: true,
      data: {
        projeto: projetoAtualizado,
        avisos,
        trechosAPreencher: contarPreencher(Object.values(geradas)),
        conferencia,
      },
    });
  } catch (error: any) {
    if (error instanceof ProponenteAusenteError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    console.error('Erro ao gerar proposta:', error);
    return NextResponse.json({ success: false, error: error.message || 'Erro interno' }, { status: 500 });
  }
}
