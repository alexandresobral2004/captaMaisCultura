import { NextRequest, NextResponse } from 'next/server';
import { EditalService } from '@/lib/database/services/edital.service';
import { paginatedResponse, errorResponse, handleApiError } from '@/lib/api/responses';

const service = new EditalService();

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const search = searchParams.get('search') || searchParams.get('q');
    if (!search) {
      return NextResponse.json(
        errorResponse('INVALID_QUERY', 'Termo de busca e obrigatorio'),
        { status: 400 }
      );
    }

    const result = await service.buscarFullText({
      search,
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
      status: searchParams.get('status') || undefined,
      orgao: searchParams.get('orgao') || undefined,
      tecnologia: searchParams.get('tecnologia') || undefined,
      scoreMin: searchParams.get('scoreMin')
        ? parseInt(searchParams.get('scoreMin')!)
        : undefined,
    });

    return NextResponse.json(
      paginatedResponse(
        result.data,
        result.total,
        parseInt(searchParams.get('page') || '1'),
        parseInt(searchParams.get('limit') || '20')
      )
    );
  } catch (error) {
    return NextResponse.json(handleApiError(error), { status: 500 });
  }
}
