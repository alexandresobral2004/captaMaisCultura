import { NextRequest, NextResponse } from 'next/server';
import { ProposalWriterCientifico } from '@/lib/analise-cientifica/writer';
import { Logger } from '@/lib/analise-cientifica/logger';
import { projetos } from '@/lib/analise-cientifica/db-mock';
import { buscarDadosProjetoMCP } from '@/lib/ai/tavily-mcp.client';

const logger = new Logger('api/gerar-completo');

interface GerarCompletoRequest {
  titulo: string;
  areaTematica: string;
  nivel: string;
  contexto?: {
    editalId?: string;
    orgao?: string;
    valor?: number;
    prazoMeses?: number;
    criteriosAvaliacao?: string[];
  };
  propostaUsuario?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body: GerarCompletoRequest = await request.json();
    const { titulo, areaTematica, nivel, contexto, propostaUsuario } = body;

    logger.info(`Gerando proposta completa para projeto ${params.id}`, 'api/gerar-completo');

    const projetoExistente = projetos.get(params.id);

    // Usa modelo 'full' (gpt-4o) para ter profundidade acadêmica e seguir regras estritas
    const writer = new ProposalWriterCientifico('full');

    // Executa busca web usando Tavily para coletar fundamentação teórica real
    logger.info(`Buscando dados no Tavily para: "${titulo}" em "${areaTematica}"`, 'api/gerar-completo');
    const searchRes = await buscarDadosProjetoMCP(titulo, areaTematica);

    // Contexto padrão para projetos científicos
    const edilContext = {
      titulo: contexto?.editalId
        ? `Edital ${contexto.editalId}`
        : 'Projeto de Pesquisa Institucional',
      orgao: contexto?.orgao || 'Instituição de Pesquisa',
      valor: contexto?.valor,
      prazoMeses: contexto?.prazoMeses || 12,
      objetivo: `Projeto de ${areaTematica} - Nível ${nivel}`,
      criteriosAvaliacao: contexto?.criteriosAvaliacao || [
        'Relevância científica e social',
        'Clareza dos objetivos',
        'Metodologia adequada',
        'Viabilidade orçamentária',
        'Qualificação da equipe'
      ],
      itensFinanciaveis: [
        'Bolsas de pesquisa',
        'Material de consumo',
        'Equipamentos',
        'Diárias e passagens',
        'Serviços de terceiros'
      ],
      elegibilidade: [
        'Pesquisador com título de mestre ou doutor',
        'Vínculo institucional',
        'Produção científica recente'
      ],
      areasTematicas: [areaTematica],
      nivel: nivel
    };

    const proposal = {
      id: params.id,
      titulo: titulo,
      descricao: propostaUsuario || `Proposta de projeto de ${areaTematica}`,
      areaAtuacao: areaTematica,
      propostaUsuario: propostaUsuario || `Desenvolvimento de projeto científico em ${areaTematica}`,
      nivel: nivel,
      status: projetoExistente?.status || 'rascunho',
      dataCriacao: projetoExistente?.dataCriacao || new Date().toISOString(),
      versao: projetoExistente?.versao || 1,
      resumoExecutivo: projetoExistente?.resumoExecutivo || '',
      justificativa: projetoExistente?.justificativa || '',
      objetivos: projetoExistente?.objetivos || { geral: '', especificos: [] },
      metodologia: projetoExistente?.metodologia || '',
      resultadosEsperados: projetoExistente?.resultadosEsperados || '',
      referencias: projetoExistente?.referencias || '',
      analiseExistente: projetoExistente?.analise || null,
    };

    // Gerar proposta completa passando os resultados de busca reais do Tavily
    const resultado = await writer.gerarPropostaCompleta(edilContext, proposal, searchRes.results);

    const formatToHTML = (text: string) => {
      if (!text) return '';
      if (text.includes('<p>') || text.includes('<br')) return text;
      return `<p>${text.replace(/\r?\n\r?\n/g, '</p><p>').replace(/\r?\n/g, '<br/>')}</p>`;
    };

    const resumoHTML = formatToHTML(resultado.resumoExecutivo || '');
    const justificativaHTML = formatToHTML(resultado.justificativa || '');
    const metodologiaHTML = formatToHTML(resultado.metodologia || '');
    const resultadosHTML = formatToHTML(resultado.resultadosEsperados || '');
    const referenciasHTML = formatToHTML(resultado.referencias || '');

    // Gerar proposta completa passando os resultados de busca reais do Tavily
    // Salvar no banco em memória se o projeto existir
    if (projetoExistente) {
      projetoExistente.resumoExecutivo = resumoHTML;
      projetoExistente.justificativa = justificativaHTML;
      projetoExistente.objetivos = resultado.objetivos || { geral: '', especificos: [] };
      projetoExistente.metodologia = metodologiaHTML;
      projetoExistente.resultadosEsperados = resultadosHTML;
      projetoExistente.referencias = referenciasHTML;
      projetoExistente.orcamento = resultado.orcamento || null;
      projetoExistente.cronograma = resultado.cronograma || [];
      projetoExistente.equipe = resultado.equipe || [];
      projetoExistente.dataAtualizacao = new Date().toISOString();
      projetoExistente.versao = (projetoExistente.versao || 1) + 1;

      // ... e atualizar o array secoesDinamicas com os conteúdos gerados em HTML
      let secoesList: any[] = [];
      if (projetoExistente.secoesDinamicas) {
        try {
          secoesList = typeof projetoExistente.secoesDinamicas === 'string'
            ? JSON.parse(projetoExistente.secoesDinamicas)
            : projetoExistente.secoesDinamicas;
        } catch {
          secoesList = [];
        }
      }

      if (secoesList.length === 0) {
        secoesList = [
          { id: 'resumo', chave: 'resumo', titulo: 'Resumo Executivo', conteudo: resumoHTML, completa: true, editavel: true, ordem: 0 },
          { id: 'justificativa', chave: 'justificativa', titulo: 'Justificativa', conteudo: justificativaHTML, completa: true, editavel: true, ordem: 1 },
          { id: 'objetivos', chave: 'objetivos', titulo: 'Objetivos', conteudo: '', completa: true, editavel: true, ordem: 2 },
          { id: 'metodologia', chave: 'metodologia', titulo: 'Metodologia', conteudo: metodologiaHTML, completa: true, editavel: true, ordem: 3 },
          { id: 'resultados', chave: 'resultados', titulo: 'Resultados Esperados', conteudo: resultadosHTML, completa: true, editavel: true, ordem: 4 },
          { id: 'referencias', chave: 'referencias', titulo: 'Referências Bibliográficas (ABNT)', conteudo: referenciasHTML, completa: true, editavel: true, ordem: 5 }
        ];
      } else {
        secoesList = secoesList.map(s => {
          if (s.chave === 'resumo') return { ...s, conteudo: resumoHTML };
          if (s.chave === 'justificativa') return { ...s, conteudo: justificativaHTML };
          if (s.chave === 'metodologia') return { ...s, conteudo: metodologiaHTML };
          if (s.chave === 'resultados') return { ...s, conteudo: resultadosHTML };
          if (s.chave === 'referencias') return { ...s, conteudo: referenciasHTML };
          return s;
        });
      }
      projetoExistente.secoesDinamicas = JSON.stringify(secoesList);
      
      projetos.set(params.id, projetoExistente);
    }

    logger.info(`Proposta completa gerada com sucesso`, 'api/gerar-completo');

    return NextResponse.json({
      success: true,
      data: {
        resumoExecutivo: resumoHTML,
        justificativa: justificativaHTML,
        objetivos: resultado.objetivos || { geral: '', especificos: [] },
        metodologia: metodologiaHTML,
        resultadosEsperados: resultadosHTML,
        referencias: referenciasHTML,
        secoesDinamicas: projetoExistente?.secoesDinamicas || '[]',
        orcamento: resultado.orcamento || null,
        cronograma: resultado.cronograma || [],
        equipe: resultado.equipe || []
      }
    });

  } catch (error: any) {
    logger.error(
      `Erro ao gerar proposta completa: ${error.message}`,
      'api/gerar-completo',
      { projetoId: params.id }
    );

    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
