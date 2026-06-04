import { NextRequest, NextResponse } from 'next/server';
import { EditalService } from '@/lib/database/services/edital.service';
import { successResponse, errorResponse, handleApiError } from '@/lib/api/responses';
import { AnaliseIASchema } from '@/lib/api/validators';

const service = new EditalService();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const analise = await service.buscarAnalise(params.id);

    if (!analise) {
      return NextResponse.json(
        errorResponse('NOT_FOUND', 'Analise nao encontrada para este edital'),
        { status: 404 }
      );
    }

    return NextResponse.json(successResponse(analise));
  } catch (error) {
    return NextResponse.json(handleApiError(error), { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    const analise = await service.salvarAnalise({
      editalId: params.id,
      ...body,
    });

    return NextResponse.json(successResponse(analise));
  } catch (error) {
    return NextResponse.json(handleApiError(error), { status: 400 });
  }
}
