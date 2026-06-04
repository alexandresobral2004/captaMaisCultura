import { NextRequest, NextResponse } from 'next/server';
import { EditalService } from '@/lib/database/services/edital.service';

const service = new EditalService();

/**
 * DELETE /api/editais/deletar
 * Deleta um edital do banco e remove seus PDFs
 */
export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'ID do edital é obrigatório' },
        { status: 400 }
      );
    }

    console.log(`🗑️ Deletando edital [${id}]...`);

    const edital = await service.deletar(id);

    console.log(`✅ Edital [${id}] deletado com sucesso`);

    return NextResponse.json({
      success: true,
      message: `Edital "${edital.titulo}" foi deletado com sucesso`,
      id
    });
  } catch (error: any) {
    console.error('❌ Erro ao deletar edital:', error);

    if (error.message?.includes('nao encontrado')) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Erro ao deletar edital' },
      { status: 500 }
    );
  }
}
