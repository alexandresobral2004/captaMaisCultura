import { NextRequest, NextResponse } from 'next/server';
import { PromptRepository } from '@/lib/database/repositories/prompt.repository';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const repository = new PromptRepository();
    const { id } = params;

    const historico = await repository.getHistorico(id);

    return NextResponse.json({
      success: true,
      data: historico,
    });
  } catch (error: any) {
    console.error('Erro ao buscar histórico:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno' },
      { status: 500 }
    );
  }
}
