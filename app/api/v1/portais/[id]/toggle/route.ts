import { NextRequest, NextResponse } from 'next/server';
import { PortalService } from '@/lib/database/services/portal.service';

const service = new PortalService();

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const portal = await service.toggleAtivo(params.id);

    return NextResponse.json({
      success: true,
      data: portal
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