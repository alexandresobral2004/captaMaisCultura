import { NextRequest, NextResponse } from 'next/server';
import { ProposalWriterCientifico } from '@/lib/analise-cientifica/writer';
import { Logger } from '@/lib/analise-cientifica/logger';
import { projetos } from '@/lib/analise-cientifica/db-mock';
import { buscarDadosProjetoMCP } from '@/lib/ai/tavily-mcp.client';

const logger = new Logger('api/gerar');

interface GerarRequest {
  secao: 'resumo' | 'justificativa' | 'objetivos' | 'metodologia' | 'resultados' | 'referencias';
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
    const body: GerarRequest = await request.json();
    const { secao, titulo, areaTematica, nivel, contexto, propostaUsuario } = body;

    logger.info(`Gerando seção ${secao} para projeto ${params.id}`, 'api/gerar');

    const projetoExistente = projetos.get(params.id);

    // Usa modelo 'full' (gpt-4o) para ter profundidade acadêmica e seguir regras estritas
    const writer = new ProposalWriterCientifico('full');

    // Executa busca web usando Tavily para coletar fundamentação teórica real
    logger.info(`Buscando dados no Tavily para fundamentar a seção ${secao}`, 'api/gerar');
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

    // Gerar proposta completa e extrair a seção solicitada
    const resultado = await writer.gerarPropostaCompleta(edilContext, proposal, searchRes.results);

    const formatToHTML = (text: string) => {
      if (!text) return '';
      if (text.includes('<p>') || text.includes('<br')) return text;
      return `<p>${text.replace(/\r?\n\r?\n/g, '</p><p>').replace(/\r?\n/g, '<br/>')}</p>`;
    };

    // Mapear resultado para a seção solicitada
    let conteudoGerado = '';

    switch (secao) {
      case 'resumo':
        conteudoGerado = formatToHTML(resultado.resumoExecutivo || '');
        break;
      case 'justificativa':
        conteudoGerado = formatToHTML(resultado.justificativa || '');
        break;
      case 'objetivos':
        conteudoGerado = resultado.objetivos
          ? JSON.stringify(resultado.objetivos, null, 2)
          : '';
        break;
      case 'metodologia':
        conteudoGerado = formatToHTML(resultado.metodologia || '');
        break;
      case 'resultados':
        conteudoGerado = formatToHTML(resultado.resultadosEsperados || '');
        break;
      case 'referencias':
        conteudoGerado = formatToHTML(resultado.referencias || '');
        break;
    }

      // Atualizar no banco em memória se o projeto existir
    if (projetoExistente) {
      switch (secao) {
        case 'resumo':
          projetoExistente.resumoExecutivo = conteudoGerado;
          break;
        case 'justificativa':
          projetoExistente.justificativa = conteudoGerado;
          break;
        case 'objetivos':
          try {
            projetoExistente.objetivos = JSON.parse(conteudoGerado);
          } catch {
            projetoExistente.objetivos = { geral: conteudoGerado, especificos: [] };
          }
          break;
        case 'metodologia':
          projetoExistente.metodologia = conteudoGerado;
          break;
        case 'resultados':
          projetoExistente.resultadosEsperados = conteudoGerado;
          break;
        case 'referencias':
          projetoExistente.referencias = conteudoGerado;
          break;
      }

      // Atualizar também no array de seções dinâmicas
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
      if (secoesList.length > 0) {
        secoesList = secoesList.map(s => {
          if (s.chave === secao) return { ...s, conteudo: conteudoGerado };
          return s;
        });
        projetoExistente.secoesDinamicas = JSON.stringify(secoesList);
      }

      projetoExistente.dataAtualizacao = new Date().toISOString();
      projetoExistente.versao = (projetoExistente.versao || 1) + 1;
      
      projetos.set(params.id, projetoExistente);
    }

    logger.info(`Seção ${secao} gerada com sucesso`, 'api/gerar');

    return NextResponse.json({
      success: true,
      data: {
        secao,
        conteudo: conteudoGerado,
        projeto: resultado
      }
    });

  } catch (error: any) {
    logger.error(
      `Erro ao gerar seção: ${error.message}`,
      'api/gerar',
      { projetoId: params.id }
    );

    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
