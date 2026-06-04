import { NextResponse } from 'next/server';
import { getAllEditais, saveEdital, Edital } from '@/lib/db/editais-store';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, acao, dados } = body;

    if (!id || !acao) {
      return NextResponse.json(
        { error: 'ID e ação são obrigatórios' },
        { status: 400 }
      );
    }

    // Validar ação
    const acoesValidas = ['aprovar', 'corrigir', 'rejeitar'];
    if (!acoesValidas.includes(acao)) {
      return NextResponse.json(
        { error: `Ação inválida. Válidas: ${acoesValidas.join(', ')}` },
        { status: 400 }
      );
    }

    // Buscar edital
    const editais = await getAllEditais(true);
    const editalIndex = editais.findIndex((e: Edital) => e.id === id);

    if (editalIndex === -1) {
      return NextResponse.json(
        { error: 'Edital não encontrado' },
        { status: 404 }
      );
    }

    const edital = editais[editalIndex];
    const agora = new Date();

    // Processar ação
    switch (acao) {
      case 'aprovar': {
        console.log(`✅ Aprovando edital [${id}]`);
        edital.statusRevisao = 'aprovado';
        edital.validadoManualmente = true;
        edital.dataAprovacao = agora;
        edital.status = 'Aberto'; // Marca como aberto no sistema
        break;
      }

      case 'corrigir': {
        console.log(`📝 Corrigindo edital [${id}]`);
        if (!dados || Object.keys(dados).length === 0) {
          return NextResponse.json(
            { error: 'Dados corrigidos são obrigatórios para ação "corrigir"' },
            { status: 400 }
          );
        }

        // Mesclar dados corrigidos
        const camposPermitidos = [
          'titulo',
          'orgao',
          'valor',
          'valorMin',
          'valorMax',
          'dataPublicacao',
          'dataLimite',
          'dataResultado',
          'descricao',
          'objetivo',
          'requisitos',
          'elegibilidade',
          'documentosNecessarios',
          'areasTematicas',
          'abrangencia',
          'tipoProponente',
          'modalidade'
        ];

        for (const [key, value] of Object.entries(dados)) {
          if (camposPermitidos.includes(key)) {
            (edital as any)[key] = value;
          }
        }

        edital.statusRevisao = 'pendente'; // Volta para revisão após correção
        edital.validadoManualmente = true;
        edital.atualizadoEm = agora.toISOString();

        console.log(`  ✏️ Campos atualizados: ${Object.keys(dados).join(', ')}`);
        break;
      }

      case 'rejeitar': {
        console.log(`❌ Rejeitando edital [${id}]`);
        edital.statusRevisao = 'rejeitado';
        edital.validadoManualmente = true;
        edital.status = 'Fechado'; // Marca como fechado
        edital.foraDoEscopo = true;
        break;
      }
    }

    // Salvar edital atualizado
    await saveEdital(edital);

    return NextResponse.json({
      success: true,
      mensagem: `Edital ${id} ${acao} com sucesso`,
      edital: {
        id: edital.id,
        titulo: edital.titulo,
        statusRevisao: edital.statusRevisao,
        status: edital.status,
        dataAprovacao: edital.dataAprovacao,
        validadoManualmente: edital.validadoManualmente
      }
    });
  } catch (error) {
    console.error('Erro na API de revisão:', error);
    return NextResponse.json(
      { error: 'Erro ao processar revisão: ' + (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * GET - Retorna editais pendentes de revisão
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'pendente';

    const editais = await getAllEditais(true);

    // Filtrar por status de revisão
    const editaisPendentes = editais.filter((e: Edital) => e.statusRevisao === status);

    // Ordenar por confiança (menores primeiro para revisar primeiro)
    editaisPendentes.sort((a: Edital, b: Edital) => {
      const confA = a.confiancaPorCampo
        ? Object.values(a.confiancaPorCampo).reduce((acc: number, val) => acc + (typeof val === 'number' ? val : 0), 0) /
          Object.keys(a.confiancaPorCampo).length
        : 50;
      const confB = b.confiancaPorCampo
        ? Object.values(b.confiancaPorCampo).reduce((acc: number, val) => acc + (typeof val === 'number' ? val : 0), 0) /
          Object.keys(b.confiancaPorCampo).length
        : 50;
      return confA - confB;
    });

    return NextResponse.json({
      success: true,
      status,
      quantidade: editaisPendentes.length,
      editais: editaisPendentes
    });
  } catch (error) {
    console.error('Erro ao buscar editais em revisão:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar editais: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
