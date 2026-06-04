import { NextRequest, NextResponse } from 'next/server';
import { EditalService } from '@/lib/database/services/edital.service';
import { successResponse, handleApiError } from '@/lib/api/responses';

const service = new EditalService();

export async function GET(request: NextRequest) {
  try {
    const stats = await service.obterEstatisticas();

    return NextResponse.json(successResponse(stats));
  } catch (error) {
    return NextResponse.json(handleApiError(error), { status: 500 });
  }
}
