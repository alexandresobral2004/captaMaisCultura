import { NextRequest, NextResponse } from 'next/server';
import { EditalService } from '@/lib/database/services/edital.service';
import { FileService } from '@/lib/database/services/file.service';
import { errorResponse, handleApiError } from '@/lib/api/responses';
import fs from 'fs/promises';
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

    const fullPath = path.join(process.cwd(), 'data', edital.pdfPath);

    // Verificar se arquivo existe
    try {
      await fs.access(fullPath);
    } catch {
      return NextResponse.json(
        errorResponse('FILE_NOT_FOUND', 'Arquivo PDF nao encontrado no disco'),
        { status: 404 }
      );
    }

    const fileBuffer = await fs.readFile(fullPath);
    const fileName = path.basename(edital.pdfPath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    });
  } catch (error) {
    return NextResponse.json(handleApiError(error), { status: 500 });
  }
}
