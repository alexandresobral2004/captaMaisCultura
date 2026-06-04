import { NextRequest, NextResponse } from 'next/server';
import { EditalService } from '@/lib/database/services/edital.service';
import { successResponse, errorResponse, handleApiError } from '@/lib/api/responses';

const service = new EditalService();

const StatusSchema = {
  validStatuses: ['Aberto', 'Prorrogado', 'Em Analise', 'Fechado'],
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { status } = body;

    if (!status || !StatusSchema.validStatuses.includes(status)) {
      return NextResponse.json(
        errorResponse('INVALID_STATUS', `Status invalido. Use: ${StatusSchema.validStatuses.join(', ')}`),
        { status: 400 }
      );
    }

    const edital = await service.atualizar(params.id, { status });

    return NextResponse.json(successResponse(edital));
  } catch (error: any) {
    if (error.message?.includes('nao encontrado')) {
      return NextResponse.json(
        errorResponse('NOT_FOUND', error.message),
        { status: 404 }
      );
    }
    return NextResponse.json(handleApiError(error), { status: 500 });
  }
}
