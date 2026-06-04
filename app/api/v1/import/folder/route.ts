import { NextRequest, NextResponse } from 'next/server';
import { ImportService } from '@/lib/database/services/import.service';
import { successResponse, handleApiError } from '@/lib/api/responses';

const service = new ImportService();

export async function POST(request: NextRequest) {
  try {
    const resultado = await service.importarPastaDownloads();

    return NextResponse.json(
      successResponse({
        message: 'Importacao concluida',
        ...resultado,
      })
    );
  } catch (error) {
    return NextResponse.json(handleApiError(error), { status: 500 });
  }
}
