import { NextRequest, NextResponse } from 'next/server';
import { verificarAdmin } from '@/lib/api/auth';
import { montarRelatorioCustos, PeriodoCustosSchema } from '@/lib/ai/relatorio-custos';
import { inicioDoMesIso } from '@/lib/ai/alerta-custo';

export async function GET(request: NextRequest) {
  try {
    const auth = await verificarAdmin(request);
    if (!auth.ok) {
      return auth.response;
    }

    const url = new URL(request.url);
    const entrada = PeriodoCustosSchema.safeParse({
      desde: url.searchParams.get('desde') ?? undefined,
      ate: url.searchParams.get('ate') ?? undefined,
    });
    if (!entrada.success) {
      return NextResponse.json(
        { success: false, error: entrada.error.issues[0]?.message ?? 'Período inválido' },
        { status: 400 }
      );
    }

    const agora = new Date();
    const relatorio = await montarRelatorioCustos({
      desde: entrada.data.desde ?? inicioDoMesIso(agora),
      ate: entrada.data.ate ?? agora.toISOString(),
      agora,
    });

    return NextResponse.json({ success: true, data: relatorio });
  } catch (error) {
    console.error('[Custos IA API] Erro ao montar relatório:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao montar relatório de custos' },
      { status: 500 }
    );
  }
}
