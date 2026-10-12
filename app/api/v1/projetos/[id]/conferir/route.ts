import { NextRequest, NextResponse } from 'next/server';
import { ProjetoService } from '@/lib/database/services/projeto.service';
import { secoesFaltando, avisosConferencia, semHtml } from '@/lib/projetos/conferencia';
import { apiKeyConfigurada, obterClienteOpenAI, obterModelo } from '@/lib/ai/client';

interface RouteParams {
  params: Promise<{ id: string }>;
}

function lista(valor: unknown): string[] {
  if (Array.isArray(valor)) return valor.map(v => (typeof v === 'string' ? v : JSON.stringify(v)));
  if (typeof valor === 'string' && valor.trim()) return [valor];
  return [];
}

/** Confere o texto do projeto contra as exigências do edital (seções, critérios, valor, elegibilidade). */
export async function POST(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const projeto = await new ProjetoService().buscarPorId(id);
    if (!projeto) return NextResponse.json({ success: false, error: 'Projeto não encontrado.' }, { status: 404 });

    const edital = projeto.edital as any;
    const analise = edital?.analiseIA;
    if (!analise) {
      return NextResponse.json({ success: false, error: 'O edital ainda não foi analisado. Analise o edital primeiro.' }, { status: 400 });
    }

    const secoes = ((projeto.secoesDinamicas as any[]) || []).map(s => ({
      titulo: s.titulo as string,
      texto: semHtml(s.conteudo),
    }));
    if (!secoes.some(s => s.texto)) {
      return NextResponse.json({ success: false, error: 'O projeto ainda não tem texto. Escreva ou gere a proposta primeiro.' }, { status: 400 });
    }

    // 1. Seções exigidas x seções com texto (regra, sem IA)
    const exigidas = lista(analise.secoesRequeridas);
    const faltando = secoesFaltando(exigidas, secoes);

    // 2. Valor solicitado x teto do edital e restrição de participação (regra)
    const avisos = avisosConferencia({
      valorSolicitado: Number(projeto.valorSolicitado || 0),
      valorMax: Number(edital.valorMax || 0),
      restritoA: analise.elegibilidade?.restritoA,
    });

    // 3. Critérios de avaliação x texto (IA)
    const criterios = lista(analise.criteriosAvaliacao);
    let criteriosResultado: { criterio: string; situacao: 'atendido' | 'parcial' | 'ausente'; observacao: string }[] = [];
    if (criterios.length && apiKeyConfigurada()) {
      const resp = await obterClienteOpenAI().chat.completions.create({
        model: obterModelo('mini'),
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [{
          role: 'user',
          content: `Confira se o texto do projeto atende a cada critério de avaliação do edital. Use SOMENTE o que está escrito no texto; não presuma nada.
Para cada critério retorne: situacao ("atendido", "parcial" ou "ausente") e observacao (uma frase curta em português dizendo o que falta ou onde está atendido).

CRITÉRIOS:
${criterios.map((c, i) => `${i + 1}. ${c}`).join('\n')}

TEXTO DO PROJETO:
${secoes.map(s => `## ${s.titulo}\n${s.texto.slice(0, 3500)}`).join('\n\n')}

Responda só JSON: {"criterios":[{"situacao":"atendido","observacao":"..."}]} na mesma ordem dos critérios.`,
        }],
      });
      const bruto = JSON.parse(resp.choices[0]?.message?.content || '{}');
      const itens: any[] = Array.isArray(bruto.criterios) ? bruto.criterios : [];
      criteriosResultado = criterios.map((criterio, i) => ({
        criterio,
        situacao: ['atendido', 'parcial', 'ausente'].includes(itens[i]?.situacao) ? itens[i].situacao : 'parcial',
        observacao: String(itens[i]?.observacao || ''),
      }));
    }

    return NextResponse.json({
      success: true,
      data: { secoesExigidas: exigidas, secoesFaltando: faltando, criterios: criteriosResultado, avisos },
    });
  } catch (error) {
    console.error('Erro ao conferir projeto:', error);
    return NextResponse.json({ success: false, error: 'Não foi possível conferir o projeto. Tente novamente.' }, { status: 500 });
  }
}
