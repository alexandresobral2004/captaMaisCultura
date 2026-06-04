import { NextRequest, NextResponse } from 'next/server';
import { EditalService } from '@/lib/database/services/edital.service';
import { FileService } from '@/lib/database/services/file.service';
import { successResponse, handleApiError } from '@/lib/api/responses';

const editalService = new EditalService();
const fileService = new FileService();

export async function GET(request: NextRequest) {
  try {
    const [totalEditais, statusPorEdital, integridade] = await Promise.all([
      editalService.contarTotal(),
      editalService.contarPorStatus(),
      fileService.verificarIntegridade(),
    ]);

    return NextResponse.json(
      successResponse({
        totalEditais,
        statusPorEdital,
        integridadeArquivos: integridade,
      })
    );
  } catch (error) {
    return NextResponse.json(handleApiError(error), { status: 500 });
  }
}
