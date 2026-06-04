import { NextRequest, NextResponse } from 'next/server';
import { EditalService } from '@/lib/database/services/edital.service';
import { FileService } from '@/lib/database/services/file.service';
import { successResponse, errorResponse, handleApiError } from '@/lib/api/responses';

const service = new EditalService();
const fileService = new FileService();

export async function DELETE(
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

    if (!edital.pdfPath) {
      return NextResponse.json(
        errorResponse('NO_PDF', 'Edital nao possui PDF associado'),
        { status: 404 }
      );
    }

    // Deletar arquivo
    await fileService.deletarArquivo(edital.pdfPath);

    // Atualizar edital
    await service.atualizar(params.id, {
      pdfPath: undefined,
      statusAnalise: 'sem_pdf',
    });

    return NextResponse.json(
      successResponse({ message: 'Arquivo deletado com sucesso' })
    );
  } catch (error) {
    return NextResponse.json(handleApiError(error), { status: 500 });
  }
}
