import { NextRequest, NextResponse } from 'next/server';
import { ProjetoService } from '@/lib/database/services/projeto.service';
import { ProposalWriter } from '@/lib/ai/writer';
import { proposalEngine, TargetMetrics, InstitutionContext } from '@/lib/ai/engines/proposal-writer.engine';

import { obterClienteOpenAI, obterModelo } from '@/lib/ai/client';
interface RouteParams {
  params: Promise<{ id: string }>;
}

interface EditalContext {
  titulo: string;
  orgao: string;
  valor?: number;
  valorMax?: number;
  prazoMeses?: number;
  objetivo: string;
  criteriosAvaliacao: string[];
  itensFinanciaveis: string[];
  elegibilidade: string[];
  areasTematicas?: string[];
}

function normalizeToStringArray(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((v: any) => typeof v === 'string');
  if (typeof value === 'string') return [value];
  return [];
}

function normalizeElegibilidade(elegibilidade: any): string[] {
  if (!elegibilidade) return [];
  if (Array.isArray(elegibilidade)) return elegibilidade.filter((v: any) => typeof v === 'string');
  if (typeof elegibilidade === 'string') return [elegibilidade];
  if (typeof elegibilidade === 'object') {
    const parts: string[] = [];
    if (elegibilidade.tiposProponentes?.length) {
      parts.push(`Proponentes: ${elegibilidade.tiposProponentes.join(', ')}`);
    }
    if (elegibilidade.requisitos?.length) {
      parts.push(`Requisitos: ${elegibilidade.requisitos.join(', ')}`);
    }
    if (elegibilidade.restricoes?.length) {
      parts.push(`Restricoes: ${elegibilidade.restricoes.join(', ')}`);
    }
    if (elegibilidade.observacoes) {
      parts.push(`Observacoes: ${elegibilidade.observacoes}`);
    }
    return parts.length ? parts : [];
  }
  return [];
}

async function extrairTargetMetrics(titulo: string, descricao: string, duracaoMeses: number): Promise<TargetMetrics> {
  const client = obterClienteOpenAI();

  const prompt = `Analise o título e a descrição do projeto abaixo e extraia as métricas estruturadas de impacto no formato JSON.
Extraia SOMENTE o que estiver explícito na descrição. NÃO estime nem invente: o que não constar deve ficar null (números) ou lista/texto vazio.

Título: ${titulo}
Descrição: ${descricao}

Retorne um objeto JSON estrito com a seguinte estrutura:
{
  "publicoAlvo": "breve descrição do público-alvo",
  "localizacao": "cidade/estado/região de execução, se citada",
  "duracaoMeses": ${duracaoMeses},
  "beneficiariosDiretos": null,
  "beneficiariosIndiretos": null,
  "produtosEntregues": ["produto 1", "produto 2", ...],
  "indicadoresImpacto": ["indicador de impacto 1", "indicador de impacto 2", ...]
}
Apenas o JSON, sem markdown ou explicações adicionais.`;

  const response = await client.chat.completions.create({
    model: obterModelo('mini'),
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Falha ao extrair métricas do projeto');
  }
  const bruto = JSON.parse(content) as Partial<TargetMetrics>;
  const numero = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);
  return {
    publicoAlvo: bruto.publicoAlvo || '',
    localizacao: bruto.localizacao || '',
    duracaoMeses,
    beneficiariosDiretos: numero(bruto.beneficiariosDiretos),
    beneficiariosIndiretos: numero(bruto.beneficiariosIndiretos),
    produtosEntregues: Array.isArray(bruto.produtosEntregues) ? bruto.produtosEntregues : [],
    indicadoresImpacto: Array.isArray(bruto.indicadoresImpacto) ? bruto.indicadoresImpacto : [],
  };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const service = new ProjetoService();

    const projeto = await service.buscarPorId(id);
    if (!projeto) {
      return NextResponse.json(
        { success: false, error: 'Projeto nao encontrado' },
        { status: 404 }
      );
    }

    if (!projeto.edital) {
      return NextResponse.json(
        { success: false, error: 'Edital associado nao encontrado' },
        { status: 400 }
      );
    }

    const analise = (projeto.edital as any).analiseIA;
    if (!analise) {
      return NextResponse.json(
        { success: false, error: 'Edital nao possui analise. Execute a analise primeiro.' },
        { status: 400 }
      );
    }

    const editalData = projeto.edital as any;
    const editalContext: EditalContext = {
      titulo: editalData.titulo || '',
      orgao: editalData.orgao || '',
      valor: editalData.valor ? Number(editalData.valor) : undefined,
      valorMax: editalData.valorMax ? Number(editalData.valorMax) : undefined,
      prazoMeses: editalData.prazoMeses ? Number(editalData.prazoMeses) : undefined,
      objetivo: analise.objetivo || '',
      criteriosAvaliacao: normalizeToStringArray(analise.criteriosAvaliacao),
      itensFinanciaveis: normalizeToStringArray(analise.itensFinanciaveis),
      elegibilidade: normalizeElegibilidade(analise.elegibilidade),
      areasTematicas: editalData.areasTematicas ? JSON.parse(editalData.areasTematicas) : undefined,
    };

    const writer = new ProposalWriter('mini');

    const proposalUser = {
      titulo: projeto.titulo,
      descricao: projeto.descricao || '',
      areaAtuacao: projeto.areaAtuacao || undefined,
      propostaUsuario: projeto.propostaUsuario || projeto.descricao || '',
    };

    const secoesDinamicasAtuais = (projeto.secoesDinamicas as any[]) || [];
    const resultado = await writer.gerarPropostaDinamica(editalContext, proposalUser, secoesDinamicasAtuais);

    // Contexto da instituição: somente dados informados pelo usuário (nada inventado)
    const dadosProponente = projeto.dadosProponente as any;
    if (!dadosProponente?.nomeProponente?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Preencha o nome do proponente (aba Dados do proponente) antes de gerar o projeto.' },
        { status: 400 }
      );
    }
    const defaultInstitution: InstitutionContext = {
      nome: dadosProponente.nomeProponente,
      cnpj: dadosProponente.cnpjCpf || '',
      historico: dadosProponente.historico || '',
      projetosAnteriores: Array.isArray(dadosProponente.projetosAnteriores) ? dadosProponente.projetosAnteriores : [],
      certificacoes: Array.isArray(dadosProponente.certificacoes) ? dadosProponente.certificacoes : [],
      capacidadeTecnica: dadosProponente.capacidadeTecnica || '',
    };

    // Extrair métricas explícitas no texto do projeto (sem estimar)
    const targetMetrics = await extrairTargetMetrics(
      projeto.titulo,
      proposalUser.descricao,
      resultado.prazoMeses || 12
    );

    // Gerar as três seções centrais utilizando a nova Engine de Restrições Rígidas (Engenharia de Requisitos)
    const rigidas = await proposalEngine.generateFullProposal(
      editalContext,
      defaultInstitution,
      targetMetrics
    );

    // Formatar as seções rígidas geradas como HTML
    const justificativaHTML = rigidas.justificativa.paragraphs.map(p => `<p>${p}</p>`).join('');
    const metodologiaHTML = rigidas.metodologia.paragraphs.map(p => `<p>${p}</p>`).join('');

    // Objetivos: O primeiro parágrafo é de introdução, os demais são os objetivos específicos (bullets)
    const objetivosIntro = rigidas.objetivos.paragraphs[0] ? `<p>${rigidas.objetivos.paragraphs[0]}</p>` : '';
    const objetivosBullets = rigidas.objetivos.paragraphs.length > 1
      ? `<ul>${rigidas.objetivos.paragraphs.slice(1).map(p => `<li>${p.replace(/^[\-•\s*]+/, '').trim()}</li>`).join('')}</ul>`
      : '';
    const objetivosHTML = `${objetivosIntro}${objetivosBullets}`;

    // Sobrescrever os conteúdos das seções geradas dinamicamente
    const secoesDinamicasList = secoesDinamicasAtuais.map(s => {
      let novoConteudo = resultado.secoes[s.chave] || s.conteudo || '';
      if (s.chave === 'justificativa') novoConteudo = justificativaHTML;
      if (s.chave === 'metodologia') novoConteudo = metodologiaHTML;
      if (s.chave === 'objetivos') novoConteudo = objetivosHTML;
      return {
        ...s,
        conteudo: novoConteudo
      };
    });

    const atualizacao = {
      resumoExecutivo: resultado.secoes['resumoExecutivo'] || '',
      justificativa: justificativaHTML,
      objetivos: objetivosHTML,
      metodologia: metodologiaHTML,
      resultadosEsperados: resultado.secoes['resultadosEsperados'] || '',
      cronograma: resultado.secoes['cronograma'] || '',
      orcamentoDetalhado: resultado.secoes['orcamentoDetalhado'] || '',

      secoesDinamicas: JSON.stringify(secoesDinamicasList),
      valorSolicitado: resultado.valorSolicitado,
      prazoMeses: resultado.prazoMeses,
      equipe: resultado.equipe,
      criteriosAtendidos: resultado.criteriosAtendidos,
      criteriosPendentes: resultado.criteriosPendentes,
      scoreCompliance: resultado.scoreCompliance,
      status: 'gerado',
      versao: (projeto.versao || 1) + 1,
    };

    const projetoAtualizado = await service.atualizar(id, atualizacao);

    return NextResponse.json({
      success: true,
      data: {
        projeto: projetoAtualizado,
        analise: {
          criteriosAtendidos: resultado.criteriosAtendidos,
          criteriosPendentes: resultado.criteriosPendentes,
          scoreCompliance: resultado.scoreCompliance,
        },
      },
    });
  } catch (error: any) {
    console.error('Erro ao gerar proposta:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno' },
      { status: 500 }
    );
  }
}