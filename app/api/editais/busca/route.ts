import { NextRequest, NextResponse } from 'next/server';
import { buscarEditaisPortais } from '@/lib/scraper/fetcher';
import { prepararEdital } from '@/lib/scraper/preparar-edital';
import { saveEdital, getEditalPorId } from '@/lib/db/editais-store';
import { getRawDb } from '@/lib/database/db';
import { iniciarBusca, finalizarBusca, situacaoDaBusca, editalJaProcessado } from '@/lib/scraper/controle-busca';
import { verificarAdmin } from '@/lib/api/auth';
import { pipelineLogger } from '@/lib/scraper/pipeline-logger';

export async function POST(request: NextRequest) {
  // Verificar se é admin
  const auth = await verificarAdmin(request);
  if (!auth.ok) {
    return auth.response;
  }

  // Limite de 2 buscas por semana, conferido e registrado antes de qualquer trabalho
  const inicio = iniciarBusca(getRawDb());
  if (!inicio.ok) {
    return NextResponse.json(
      {
        error: inicio.motivo === 'em_andamento'
          ? 'Já existe uma busca em andamento. Aguarde terminar.'
          : 'Limite de 2 buscas por semana atingido.',
        situacao: inicio.situacao,
      },
      { status: 429 }
    );
  }
  let jaExistentes = 0;

  try {
    const tempoInicio = Date.now();
    console.log('🚀 API: Iniciando busca consolidada de editais nos portais...');
    pipelineLogger.logBusca('Iniciando busca consolidada de editais...');
    const novosEditais = await buscarEditaisPortais();
    
    console.log(`\n📊 API: ${novosEditais.length} editais localizados. Iniciando download de PDFs e análise IA...`);
    pipelineLogger.logBusca(`Encontrados ${novosEditais.length} editais válidos nos portais. Iniciando processamento...`);
    const editaisAnalisados = [];
    let sucessoCount = 0;
    let erroCount = 0;

    for (const edital of novosEditais) {
      try {
        pipelineLogger.logBusca(`Processando edital: "${edital.titulo}"`);
        
        // Já baixado ou avaliado em buscas anteriores: não baixa de novo
        const existente = await getEditalPorId(edital.id);
        if (existente && editalJaProcessado(existente)) {
          jaExistentes++;
          pipelineLogger.logResultado(edital.id, edital.titulo, 'rejeitado', 'Já existe no banco');
          continue;
        }

        // ✨ NOVO: Skip se edital está fora do escopo
        if (edital.foraDoEscopo === true) {
          console.log(`⏭️ [${edital.id}] Fora do escopo. Pulando.`);
          pipelineLogger.logResultado(edital.id, edital.titulo, 'rejeitado', 'Fora do escopo');
          erroCount++;
          continue;
        }
        const preparado = await prepararEdital(edital);

        // ✨ NOVO FLUXO: Salvar com status 'pendente' para análise manual
        // A IA só analisará quando o usuário clicar em "Analisar"
        const editalSalvo = await saveEdital({ ...edital, ...preparado.campos });

        console.log(`✅ [${edital.id}] Salvo com status PENDENTE - aguardando análise manual do usuário`);
        pipelineLogger.logResultado(edital.id, edital.titulo, 'salvo', `Salvo como PENDENTE (Score: ${preparado.scoreFinal}) | Fonte: ${preparado.campos.fonteConteudo}`);
        editaisAnalisados.push(editalSalvo);
        sucessoCount++;
      } catch (err) {
        console.error(`❌ Erro ao processar edital [${edital.id}]:`, err);
        pipelineLogger.logErro(edital.id, `Erro de processamento: ${(err as Error).message}`);
        pipelineLogger.logResultado(edital.id, edital.titulo, 'erro', (err as Error).message);
        edital.statusAnalise = 'erro';
        edital.erroAnalise = (err as Error).message;
        await saveEdital(edital);
        editaisAnalisados.push(edital);
        erroCount++;
      }
    }

    const tempoTotal = ((Date.now() - tempoInicio) / 60000).toFixed(2);
    pipelineLogger.logBusca(`Busca concluída. Sucessos: ${sucessoCount}, Falhas: ${erroCount} em ${tempoTotal} minutos.`);
    
    // ✨ NOVO: Estatísticas consolidadas
    const estatisticas = {
      totalEditaisValidos: novosEditais.length,
      processados: sucessoCount,
      comErro: erroCount,
      tempoMinutos: parseFloat(tempoTotal),
      porTecnologia: {} as { [key: string]: number }
    };

    // Contar por tecnologia
    for (const ed of editaisAnalisados) {
      const tech = ed.tecnologiaFoco || 'Outro';
      estatisticas.porTecnologia[tech] = (estatisticas.porTecnologia[tech] || 0) + 1;
    }

    const descartados = editaisAnalisados.filter(e => e.statusAnalise === 'descartado').length;
    const novos = sucessoCount - descartados;
    finalizarBusca(getRawDb(), inicio.id, { novos, jaExistentes, descartados, comErro: erroCount });

    return NextResponse.json({
      success: true,
      mensagem: `Busca concluída: ${novos} novos, ${jaExistentes} já existiam, ${descartados} descartados`,
      resumo: { novos, jaExistentes, descartados, comErro: erroCount },
      situacao: situacaoDaBusca(getRawDb()),
      estatisticas,
      quantidade: editaisAnalisados.length,
      editais: editaisAnalisados
    });
  } catch (error) {
    console.error('Erro na API de busca de editais:', error);
    // Busca que falhou não gasta o limite semanal
    finalizarBusca(getRawDb(), inicio.id, { novos: 0, jaExistentes, descartados: 0, comErro: 0, mensagem: (error as Error).message }, true);
    return NextResponse.json(
      { error: 'Erro no processo de busca/download/análise: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
