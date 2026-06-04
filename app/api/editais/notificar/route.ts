import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface Notificacao {
  id: string;
  tipo: 'editais_novos' | 'edital_publicado' | 'erro_analise' | 'editais_aguardando_revisao';
  titulo: string;
  descricao: string;
  quantidade?: number;
  link: string;
  lida: boolean;
  criadoEm: Date;
  urgencia?: 'baixa' | 'media' | 'alta';
}

const NOTIFICACOES_DIR = path.join(process.cwd(), 'data', 'notificacoes');

// Garantir que o diretório exista
function initNotificacoesDir() {
  if (!fs.existsSync(NOTIFICACOES_DIR)) {
    fs.mkdirSync(NOTIFICACOES_DIR, { recursive: true });
  }
}

/**
 * Salvar notificação em arquivo
 */
function salvarNotificacao(notificacao: Notificacao) {
  initNotificacoesDir();
  const filePath = path.join(NOTIFICACOES_DIR, `${notificacao.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(notificacao, null, 2), 'utf-8');
}

/**
 * Buscar todas as notificações (helper interno)
 */
function obterNotificacoes(filtro?: { lida?: boolean; tipo?: string }): Notificacao[] {
  initNotificacoesDir();

  if (!fs.existsSync(NOTIFICACOES_DIR)) {
    return [];
  }

  const arquivos = fs.readdirSync(NOTIFICACOES_DIR);
  let notificacoes: Notificacao[] = [];

  for (const arquivo of arquivos) {
    if (arquivo.endsWith('.json')) {
      try {
        const conteudo = fs.readFileSync(path.join(NOTIFICACOES_DIR, arquivo), 'utf-8');
        const notif = JSON.parse(conteudo) as Notificacao;
        notif.criadoEm = new Date(notif.criadoEm);

        // Aplicar filtros
        if (filtro?.lida !== undefined && notif.lida !== filtro.lida) continue;
        if (filtro?.tipo && notif.tipo !== filtro.tipo) continue;

        notificacoes.push(notif);
      } catch (erro) {
        console.error(`Erro ao ler notificação ${arquivo}:`, erro);
      }
    }
  }

  // Ordenar por data (mais recentes primeiro)
  notificacoes.sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime());

  return notificacoes;
}

/**
 * Marcar notificação como lida (helper interno)
 */
function marcarComoLida(id: string) {
  initNotificacoesDir();
  const filePath = path.join(NOTIFICACOES_DIR, `${id}.json`);

  if (fs.existsSync(filePath)) {
    const notif = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Notificacao;
    notif.lida = true;
    fs.writeFileSync(filePath, JSON.stringify(notif, null, 2), 'utf-8');
  }
}

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

    salvarNotificacao(notificacao);

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

    const filtro: { lida?: boolean; tipo?: string } = {};
    if (lida !== null) filtro.lida = lida === 'true';
    if (tipo) filtro.tipo = tipo;

    const notificacoes = obterNotificacoes(filtro).slice(0, limite);

    // Contar não-lidas
    const naoLidas = obterNotificacoes({ lida: false });

    return NextResponse.json({
      success: true,
      quantidade: notificacoes.length,
      naoLidas: naoLidas.length,
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

    marcarComoLida(id);

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
