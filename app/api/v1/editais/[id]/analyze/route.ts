import { NextRequest, NextResponse } from 'next/server';
import { EditalService } from '@/lib/database/services/edital.service';
import { FileService } from '@/lib/database/services/file.service';
import { successResponse, errorResponse, handleApiError } from '@/lib/api/responses';

const service = new EditalService();
const fileService = new FileService();

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const edital = await service.buscarPorId(params.id);

    if (!edital) {
      return NextResponse.json(
        errorResponse('NOT_FOUND', 'Edital nao encontrado'),
        { status: 404 }
      );
    }

    if (!edital.conteudoCompleto && !edital.pdfPath) {
      return NextResponse.json(
        errorResponse('NO_CONTENT', 'Edital nao possui conteudo para analisar'),
        { status: 400 }
      );
    }

    // TODO: Integrar com OpenAI para analise
    // Por enquanto, retorna placeholder
    const analise = await service.salvarAnalise({
      editalId: params.id,
      resumo: `Analise pendente para: ${edital.titulo}`,
      objetivo: 'A definir',
      elegibilidade: 'A definir',
      scoreAdequacao: 0,
    });

    return NextResponse.json(
      successResponse({
        message: 'Analise iniciada',
        analise,
      })
    );
  } catch (error) {
    return NextResponse.json(handleApiError(error), { status: 500 });
  }
}
