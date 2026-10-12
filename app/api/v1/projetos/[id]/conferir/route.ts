import { NextRequest, NextResponse } from 'next/server';
import { ProjetoService } from '@/lib/database/services/projeto.service';
import { julgarComOpenAI } from '@/lib/projetos/julgar-ia';
import { conferirProjeto, ConferenciaErro } from '@/lib/projetos/conferencia';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Confere o texto do projeto contra as exigências do edital (seções, critérios, valor, elegibilidade). */
export async function POST(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const projeto = await new ProjetoService().buscarPorId(id);
    if (!projeto) return NextResponse.json({ success: false, error: 'Projeto não encontrado.' }, { status: 404 });
    const data = await conferirProjeto(projeto, julgarComOpenAI);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof ConferenciaErro) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Erro ao conferir projeto:', error);
    return NextResponse.json({ success: false, error: 'Não foi possível conferir o projeto. Tente novamente.' }, { status: 500 });
  }
}
