import { NextRequest, NextResponse } from 'next/server';
import { EditalService } from '@/lib/database/services/edital.service';
import { successResponse, errorResponse, paginatedResponse, handleApiError } from '@/lib/api/responses';
import { ListEditaisQuerySchema } from '@/lib/api/validators';

const service = new EditalService();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const query = ListEditaisQuerySchema.parse({
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
      status: searchParams.get('status') || undefined,
      orgao: searchParams.get('orgao') || undefined,
      tecnologia: searchParams.get('tecnologia') || undefined,
      scoreMin: searchParams.get('scoreMin') || undefined,
      scoreMax: searchParams.get('scoreMax') || undefined,
      dataInicio: searchParams.get('dataInicio') || undefined,
      dataFim: searchParams.get('dataFim') || undefined,
      search: searchParams.get('search') || undefined,
      sortBy: searchParams.get('sortBy') || undefined,
      sortOrder: searchParams.get('sortOrder') || undefined,
      categoriaArea: searchParams.get('categoriaArea') || undefined,
    });

    const result = await service.listar(query);

    return NextResponse.json(
      paginatedResponse(result.data, result.total, query.page, query.limit)
    );
  } catch (error) {
    return NextResponse.json(handleApiError(error), { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const edital = await service.criar(body);

    return NextResponse.json(successResponse(edital), { status: 201 });
  } catch (error: any) {
    if (error.message?.includes('ja existe')) {
      return NextResponse.json(
        errorResponse('CONFLICT', error.message),
        { status: 409 }
      );
    }
    return NextResponse.json(handleApiError(error), { status: 400 });
  }
}
