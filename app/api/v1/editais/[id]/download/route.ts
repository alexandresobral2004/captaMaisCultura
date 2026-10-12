import { NextRequest, NextResponse } from 'next/server';
import { EditalService } from '@/lib/database/services/edital.service';
import { FileService } from '@/lib/database/services/file.service';
import { errorResponse, handleApiError } from '@/lib/api/responses';
import path from 'path';

const service = new EditalService();
const fileService = new FileService();

export async function GET(
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

    let fileBuffer: Buffer;
    try {
      fileBuffer = await fileService.lerArquivo(edital.pdfPath);
    } catch (err: any) {
      if (err?.message?.includes('Directory Traversal')) {
        return NextResponse.json(
          errorResponse('FORBIDDEN', 'Caminho de arquivo invalido'),
          { status: 403 }
        );
      }
      return NextResponse.json(
        errorResponse('FILE_NOT_FOUND', 'Arquivo PDF nao encontrado no disco'),
        { status: 404 }
      );
    }
    const fileName = path.basename(edital.pdfPath);

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName.replace(/[^\w.\-]/g, '_')}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
