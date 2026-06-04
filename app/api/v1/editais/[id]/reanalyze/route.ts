import { NextRequest, NextResponse } from 'next/server';
import { EditalService } from '@/lib/database/services/edital.service';
import { analisarEditalComIA } from '@/lib/ai/analyzer';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: { message: 'ID do edital é obrigatório' } },
        { status: 400 }
      );
    }

    console.log(`\n🔄 [Reanalyze] Iniciando re-análise do edital ${id}`);
    
    const edilService = new EditalService();
    
    // Buscar edital completo
    const edital = await edilService.buscarPorId(id);
    
    if (!edital) {
      return NextResponse.json(
        { success: false, error: { message: 'Edital não encontrado' } },
        { status: 404 }
      );
    }

    // Verificar se tem conteúdo para analisar
    const textoCompleto = edital.conteudoCompleto;
    
    if (!textoCompleto || textoCompleto.length < 100) {
      return NextResponse.json(
        { success: false, error: { message: 'Edital não possui conteúdo suficiente para análise' } },
        { status: 400 }
      );
    }

    console.log(`🔍 [Reanalyze] Texto disponível: ${textoCompleto.length} caracteres`);

    // Delay de 5 segundos para evitar rate limit
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Executar análise completa
    console.log(`🤖 [Reanalyze] Chamando análise IA...`);
    const resultado = await analisarEditalComIA(id, textoCompleto, { modo: 'completo' });

    if (resultado && resultado.statusAnalise === 'analisado') {
      console.log(`✅ [Reanalyze] Análise concluída com sucesso para edital ${id}`);
      
      return NextResponse.json({
        success: true,
        data: {
          id,
          status: resultado.statusAnalise,
          statusRevisao: resultado.statusRevisao,
          mensagem: 'Re-análise concluída com sucesso'
        }
      });
    } else {
      console.warn(`⚠️ [Reanalyze] Análise retornou status inesperado`);
      
      return NextResponse.json({
        success: false,
        error: { 
          message: 'Análise não foi concluída corretamente',
          status: resultado?.statusAnalise
        }
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error(`❌ [Reanalyze] Erro ao re-analisar edital:`, error.message);
    
    // Tentar atualizar status de erro
    try {
      const edilService = new EditalService();
      await edilService.atualizar(params.id, {
        statusAnalise: 'erro',
        erroAnalise: error.message,
      });
    } catch (updateError: any) {
      console.error(`Erro ao atualizar status:`, updateError.message);
    }

    return NextResponse.json(
      { success: false, error: { message: error.message || 'Erro ao re-analisar edital' } },
      { status: 500 }
    );
  }
}