import { NextResponse } from 'next/server';
import { getAllEditais } from '../../../../lib/db/editais-store';
import { processarEditalUnico, processarFilaDeEditais } from '../../../../lib/scraper/pipeline';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, analisarTodosPendentes } = body;

    if (analisarTodosPendentes) {
      // Inicia em background para não travar a request
      processarFilaDeEditais().catch(err => console.error("Erro na fila em background:", err));
      return NextResponse.json({ message: 'Processamento de todos os editais pendentes iniciado em background.' });
    }

    if (!id) {
      return NextResponse.json({ error: 'ID do edital é obrigatório para análise individual.' }, { status: 400 });
    }

    const editais = await getAllEditais(true);
    const edital = editais.find(e => e.id === id);

    if (!edital) {
      return NextResponse.json({ error: 'Edital não encontrado.' }, { status: 404 });
    }

    if (edital.statusAnalise === 'analisado') {
      return NextResponse.json({ error: 'Este edital já foi analisado anteriormente.' }, { status: 400 });
    }

    // Processa bloqueando a request para dar feedback imediato
    let sucesso = false;
    if (edital.fonteConteudo === 'pdf_upload' || edital.id.startsWith('upload-')) {
      const { EditalUploadService } = require('@/lib/database/services/edital-upload.service');
      const uploadService = new EditalUploadService();
      sucesso = await uploadService.reanalisarEditalUpload(id);
    } else {
      sucesso = await processarEditalUnico(edital);
    }

    if (sucesso) {
      return NextResponse.json({ message: `Edital ${id} analisado com sucesso!` });
    } else {
      return NextResponse.json({ error: `Falha ao analisar edital ${id}. Verifique os logs.` }, { status: 500 });
    }

  } catch (error) {
    console.error('Erro na API de análise de editais:', error);
    return NextResponse.json({ error: 'Erro interno ao processar a requisição.' }, { status: 500 });
  }
}
