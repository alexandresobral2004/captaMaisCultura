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

    const formData = await request.formData();
    const file = formData.get('pdf') as File;

    if (!file) {
      return NextResponse.json(
        errorResponse('NO_FILE', 'Nenhum arquivo fornecido'),
        { status: 400 }
      );
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        errorResponse('INVALID_TYPE', 'Apenas arquivos PDF sao aceitos'),
        { status: 400 }
      );
    }

    // Deletar PDF anterior se existir
    if (edital.pdfPath) {
      await fileService.deletarArquivo(edital.pdfPath);
    }

    // Salvar novo PDF
    const buffer = Buffer.from(await file.arrayBuffer());
    const pdfPath = await fileService.salvarPDF(buffer, params.id, file.name);

    // Atualizar edital
    await service.atualizar(params.id, {
      pdfPath,
      statusAnalise: 'pdf_baixado',
    });

    return NextResponse.json(
      successResponse({
        message: 'PDF uploadado com sucesso',
        pdfPath,
        tamanho: buffer.length,
      })
    );
  } catch (error) {
    return NextResponse.json(handleApiError(error), { status: 500 });
  }
}
