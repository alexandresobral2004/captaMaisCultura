import { NextRequest, NextResponse } from 'next/server';
import { PortalService, PortalDTO } from '@/lib/database/services/portal.service';
import { migrarJsonParaBanco } from '@/lib/scraper/config';
import { z } from 'zod';

const service = new PortalService();
let migrationChecked = false;

const CreatePortalSchema = z.object({
  id: z.string().min(1).optional(),
  nome: z.string().min(1, 'Nome é obrigatório'),
  urlBusca: z.string().url('URL inválida'),
  urlsFallback: z.array(z.string().url()).optional(),
  tipo: z.enum(['rss', 'html', 'api', 'session']),
  categoria: z.string().min(1, 'Categoria é obrigatória'),
  ativo: z.boolean().default(true),
  scraperModule: z.string().optional(),
  intervaloMinutos: z.number().min(15).default(60),
  credEmail: z.string().email().optional().or(z.literal('')),
});

export async function GET() {
  try {
    if (!migrationChecked) {
      migrationChecked = true;
      await migrarJsonParaBanco();
    }

    const portais = await service.listar();
    return NextResponse.json({ success: true, data: portais });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = CreatePortalSchema.parse(body);

    const portal = await service.criar(data as PortalDTO);

    return NextResponse.json(
      { success: true, data: portal },
      { status: 201 }
    );
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { message: 'Dados inválidos', details: error.issues } },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: { message: error.message } },
      { status: 400 }
    );
  }
}