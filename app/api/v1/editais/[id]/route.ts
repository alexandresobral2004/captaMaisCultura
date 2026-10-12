import { NextRequest, NextResponse } from 'next/server';
import { EditalService } from '@/lib/database/services/edital.service';
import { successResponse, errorResponse, handleApiError } from '@/lib/api/responses';
import { UpdateEditalSchema } from '@/lib/api/validators';

// pdfPath só é definido no servidor (upload/file); nunca pelo cliente
const UpdateEditalBodySchema = UpdateEditalSchema.omit({ pdfPath: true });

const service = new EditalService();

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

    return NextResponse.json(successResponse(edital));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = UpdateEditalBodySchema.parse(await request.json());
    const edital = await service.atualizar(params.id, body);

    return NextResponse.json(successResponse(edital));
  } catch (error: any) {
    if (error.message?.includes('nao encontrado')) {
      return NextResponse.json(
        errorResponse('NOT_FOUND', error.message),
        { status: 404 }
      );
    }
    return handleApiError(error, undefined, 400);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const edital = await service.deletar(params.id);

    return NextResponse.json(
      successResponse({ message: 'Edital deletado com sucesso', edital })
    );
  } catch (error: any) {
    if (error.message?.includes('nao encontrado')) {
      return NextResponse.json(
        errorResponse('NOT_FOUND', error.message),
        { status: 404 }
      );
    }
    return handleApiError(error);
  }
}
