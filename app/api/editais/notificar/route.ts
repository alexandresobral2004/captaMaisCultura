import { NextResponse } from 'next/server';
import { randomUUID as uuidv4 } from 'crypto';
import {
  salvarNotificacao,
  listarNotificacoes,
  contarNaoLidas,
  marcarNotificacaoLida,
  type Notificacao,
} from '../../../../lib/database/repositories/notificacao.repository';

/**
 * POST - Criar nova notificação
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tipo, titulo, descricao, quantidade, link, urgencia } = body;

    if (!tipo || !titulo || !link) {
      return NextResponse.json(
        { error: 'tipo, titulo e link são obrigatórios' },
        { status: 400 }
      );
    }

    const notificacao: Notificacao = {
      id: uuidv4(),
      tipo,
      titulo,
      descricao: descricao || '',
      quantidade: quantidade || 1,
      link,
      lida: false,
      criadoEm: new Date(),
      urgencia: urgencia || 'media'
    };

    await salvarNotificacao(notificacao);

    console.log(`🔔 Notificação criada: ${titulo}`);

    return NextResponse.json({
      success: true,
      mensagem: 'Notificação criada com sucesso',
      notificacao
    });
  } catch (error) {
    console.error('Erro ao criar notificação:', error);
    return NextResponse.json(
      { error: 'Erro ao criar notificação: ' + (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * GET - Obter notificações
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const lida = url.searchParams.get('lida');
    const tipo = url.searchParams.get('tipo');
    const limite = parseInt(url.searchParams.get('limite') || '10', 10);

    const notificacoes = await listarNotificacoes({
      lida: lida === null ? undefined : lida === 'true',
      tipo: tipo || undefined,
      limite,
    });

    return NextResponse.json({
      success: true,
      quantidade: notificacoes.length,
      naoLidas: await contarNaoLidas(),
      notificacoes
    });
  } catch (error) {
    console.error('Erro ao buscar notificações:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar notificações: ' + (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * PUT - Marcar notificação como lida
 */
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'ID da notificação é obrigatório' },
        { status: 400 }
      );
    }

    await marcarNotificacaoLida(id);

    return NextResponse.json({
      success: true,
      mensagem: 'Notificação marcada como lida'
    });
  } catch (error) {
    console.error('Erro ao atualizar notificação:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar notificação: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
