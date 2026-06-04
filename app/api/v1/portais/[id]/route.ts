import { NextRequest, NextResponse } from 'next/server';
import { PortalService, PortalDTO } from '@/lib/database/services/portal.service';
import { z } from 'zod';

const service = new PortalService();

const UpdatePortalSchema = z.object({
  nome: z.string().min(1).optional(),
  urlBusca: z.string().url().optional(),
  urlsFallback: z.array(z.string().url()).optional(),
  tipo: z.enum(['rss', 'html', 'api', 'session']).optional(),
  categoria: z.string().min(1).optional(),
  ativo: z.boolean().optional(),
  scraperModule: z.string().optional(),
  intervaloMinutos: z.number().min(15).optional(),
  credEmail: z.string().email().optional().or(z.literal('')),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const portal = await service.buscarPorId(params.id);

    if (!portal) {
      return NextResponse.json(
        { success: false, error: { message: 'Portal não encontrado' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: portal });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message } },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const data = UpdatePortalSchema.parse(body);

    const portal = await service.atualizar(params.id, data as Partial<PortalDTO>);

    return NextResponse.json({ success: true, data: portal });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { message: 'Dados inválidos', details: error.issues } },
        { status: 400 }
      );
    }
    if (error.message?.includes('não encontrado')) {
      return NextResponse.json(
        { success: false, error: { message: error.message } },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { success: false, error: { message: error.message } },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await service.deletar(params.id);

    return NextResponse.json({
      success: true,
      data: { message: 'Portal removido com sucesso' }
    });
  } catch (error: any) {
    if (error.message?.includes('não encontrado')) {
      return NextResponse.json(
        { success: false, error: { message: error.message } },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { success: false, error: { message: error.message } },
      { status: 400 }
    );
  }
}