import { NextRequest, NextResponse } from 'next/server';
import { EditalService } from '@/lib/database/services/edital.service';
import { successResponse, errorResponse, paginatedResponse, handleApiError } from '@/lib/api/responses';
import { ListEditaisQuerySchema } from '@/lib/api/validators';

export const dynamic = 'force-dynamic';

const service = new EditalService();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const query = ListEditaisQuerySchema.parse({
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
      status: searchParams.get('status') || undefined,
      statusAnalise: searchParams.get('statusAnalise') || undefined,
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
    return handleApiError(error, undefined, 400);
  }
}

/** Limite por chamada: uma seleção maior que isto vem em mais de uma requisição. */
const MAXIMO_POR_EXCLUSAO = 500;

/**
 * DELETE /api/v1/editais  body: { ids: string[] }
 * Exclui em lote (soft-delete). Os de prazo vencido ficam bloqueados e as buscas não os baixam de novo;
 * os demais podem voltar se reaparecerem num portal.
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const ids: unknown = body?.ids;
    if (!Array.isArray(ids) || ids.length === 0 || !ids.every(id => typeof id === 'string' && id.length > 0)) {
      return NextResponse.json(errorResponse('VALIDATION_ERROR', 'Envie "ids" como uma lista de ids de editais'), { status: 400 });
    }
    if (ids.length > MAXIMO_POR_EXCLUSAO) {
      return NextResponse.json(errorResponse('VALIDATION_ERROR', `No máximo ${MAXIMO_POR_EXCLUSAO} editais por vez`), { status: 400 });
    }

    const resultado = await service.deletarVarios(ids as string[]);
    return NextResponse.json(successResponse(resultado));
  } catch (error) {
    return handleApiError(error);
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
    return handleApiError(error, undefined, 400);
  }
}
