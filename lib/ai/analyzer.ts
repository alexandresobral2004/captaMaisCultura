import OpenAI from 'openai';
import { Edital, saveEdital, getEditalPorId } from '../db/editais-store';
import { promptAnaliseSimplificada } from './prompts';
import { validarCamposEdital } from './validator';
import { AnaliseEditalSchema, AnaliseEditalResult } from './schema-analise';
import { mensagemErroAnalise } from './erros-analise';
import { logger, LogCenarioFalha, LogAcao } from '../logger';

import { apiKeyConfigurada, criarChatModel, obterClienteOpenAI, obterModelo } from './client';
type ModoAnalise = 'completo' | 'simplificado';

interface AnalisarOptions {
  modo?: ModoAnalise;
}

const LIMITE_TEXTO = 60000;

const SYSTEM_PROMPT_COMPLETO = `Você é um especialista em análise de editais de fomento brasileiros.
Analise o texto do edital fornecido e preencha TODOS os campos do schema estruturado de forma precisa e completa.

Diretrizes gerais:
- Seja preciso e fiel ao conteúdo do documento.
- Use null quando não encontrar informação confiável ou clara.
- Não invente dados. Se algo não está no texto, use null ou array vazio.
- Atribua scores de confiança (0-100) baseado na qualidade da informação encontrada.

Diretrizes por seção:

DATAS:
- Extraia em formato DD/MM/YYYY.
- Identifique datas de publicação, abertura, limite para inscrição e resultado.
- Se apenas uma data estiver mencionada, determine qual é pelo contexto.

VALORES:
- Extraia valores numéricos em BRL (Reais).
- Se houver faixa de valores, extraia min e max.
- Inclua a referência textual como aparece no edital.
- Identifique a moeda e unidade de repasse.

ELEGIBILIDADE:
- Preencha 'restritoA' quando só um público específico puder participar (servidores de uma instituição, estudantes de um curso, moradores de um local); senão null.
- Liste quem pode participar (universidades, empresas, ONGs, etc.).
- Extraia requisitos obrigatórios e restrições.
- Identifique a abrangência geográfica.
- Liste as áreas temáticas e foco geográfico se houver.

DOCUMENTOS:
- Liste separadamente documentos obrigatórios e opcionais.
- Categorize em técnicos, fiscais e bancários quando possível.
- Conte o total estimado de documentos.

RESUMO E OBJETIVO:
- Resumo de até 5 frases, claro e objetivo.
- Objetivo principal em 1-2 frases.

AVALIAÇÃO:
- Liste os critérios de avaliação mencionados.
- Identifique penalizações que podem levar à reprovação.
- Indique pontuação mínima se houver.

CONTATO:
- Email, telefone ou canal de contato do edital.

CONSISTÊNCIA:
- Verifique se há contradições ou dados faltantes.
- Liste alertas sobre possíveis problemas.

SEÇÕES REQUERIDAS DA PROPOSTA:
- Identifique as seções/capítulos obrigatórios que a proposta técnica do projeto deve conter de acordo com o edital (ex: "Justificativa", "Objetivos", "Metodologia", "Cronograma", "Orçamento", "Ficha Técnica/Equipe", "Acessibilidade", "Democratização de Acesso"). Listar como um array simples de strings em 'secoesRequeridas'.`;

async function executarPromptJSON(openai: OpenAI, sistema: string, texto: string) {
  const response = await openai.chat.completions.create({
    model: obterModelo('mini'),
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: sistema },
      { role: 'user', content: `Documento:\n${texto}` }
    ],
    temperature: 0.1
  });

  const content = response.choices[0]?.message?.content || '{}';
  return JSON.parse(content);
}

async function analisarComSchemaUnificado(
  texto: string
): Promise<AnaliseEditalResult> {
  const model = criarChatModel({ nivel: 'mini', temperature: 0.1 });

  const modelWithSchema = model.withStructuredOutput(AnaliseEditalSchema, {
    name: 'analise_edital',
  });

  const response = await modelWithSchema.invoke([
    { role: 'system', content: SYSTEM_PROMPT_COMPLETO },
    { role: 'user', content: `Documento:\n${texto}` },
  ]);

  return response;
}

/** DD/MM/AAAA (como a IA devolve) vira AAAA-MM-DD, o formato guardado no banco. */
export function dataParaIso(valor: string): string {
  const m = valor.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : valor.trim();
}

function mapearParaEdital(
  edital: Edital,
  resultado: AnaliseEditalResult
): void {
  const e = edital as any;

  // Datas
  if (resultado.datas.publicacao) edital.dataPublicacao = dataParaIso(resultado.datas.publicacao);
  if (resultado.datas.abertura) edital.dataAbertura = dataParaIso(resultado.datas.abertura);
  if (resultado.datas.limite) edital.dataLimite = dataParaIso(resultado.datas.limite);
  if (resultado.datas.resultado) edital.dataResultado = dataParaIso(resultado.datas.resultado);

  // Valores
  if (typeof resultado.valores.valorMin === 'number') edital.valorMin = resultado.valores.valorMin;
  if (typeof resultado.valores.valorMax === 'number') edital.valorMax = resultado.valores.valorMax;
  if (resultado.valores.valorReferencia) edital.valor = resultado.valores.valorReferencia;

  // Elegibilidade (campos diretos)
  if (resultado.elegibilidade.tiposProponentes.length > 0) {
    edital.tipoProponente = resultado.elegibilidade.tiposProponentes;
  }
  if (resultado.elegibilidade.areasTematicas.length > 0) {
    edital.areasTematicas = resultado.elegibilidade.areasTematicas;
  }
  if (resultado.elegibilidade.abrangencia) {
    edital.abrangencia = resultado.elegibilidade.abrangencia;
  }

  // Documentos
  const todosDocumentos = [
    ...resultado.documentos.obrigatorios,
    ...resultado.documentos.opcionais,
  ];

  // Texto de elegibilidade (requisições concatenadas)
  const textoElegibilidade = resultado.elegibilidade.requisitos.length > 0
    ? resultado.elegibilidade.requisitos.join('\n')
    : edital.analiseIA?.elegibilidade || '';

  // Análise IA (objeto consolidado)
  edital.analiseIA = {
    resumo: resultado.resumo,
    objetivo: resultado.objetivo,
    requisitos: edital.analiseIA?.requisitos || [],
    elegibilidade: textoElegibilidade,
    itensFinanciáveis: edital.analiseIA?.itensFinanciáveis || [],
    documentosNecessarios: todosDocumentos.length > 0 ? todosDocumentos : edital.analiseIA?.documentosNecessarios || [],
    criteriosAvaliacao: [
      ...resultado.criterios,
      ...resultado.avaliacao.criteriosDetalhados,
    ],
    contatoEdital: resultado.contato || edital.analiseIA?.contatoEdital,
    pontosFracos: [
      ...(resultado.elegibilidade.restritoA ? [`Participação restrita: ${resultado.elegibilidade.restritoA}`] : []),
      ...resultado.consistencia.alertas,
    ],
    scoreAdequacao: resultado.consistencia.status === 'ok'
      ? 90
      : resultado.consistencia.status === 'duvida'
        ? 60
        : 40,
    secoesRequeridas: resultado.secoesRequeridas || [],
  };

  // Confiança por campo
  edital.confiancaPorCampo = {
    ...edital.confiancaPorCampo,
    datas: Math.round(
      (resultado.confiancas.datas.publicacao +
        resultado.confiancas.datas.limite +
        resultado.confiancas.datas.resultado) / 3
    ),
    valores: Math.round(
      (resultado.confiancas.valores.valorMin +
        resultado.confiancas.valores.valorMax +
        resultado.confiancas.valores.valorReferencia) / 3
    ),
    tiposProponentes: resultado.confiancas.tiposProponentes,
    requisitos: resultado.confiancas.requisitos,
    documentos: resultado.confiancas.documentos,
    resumo: resultado.confiancas.resumo,
    criterios: resultado.confiancas.criterios,
  };
}

export async function analisarEditalComIA(
  editalId: string,
  textoCompletoInput: string | any,
  options?: AnalisarOptions
): Promise<Edital | null> {
  const textoCompleto = typeof textoCompletoInput === 'string'
    ? textoCompletoInput
    : textoCompletoInput && typeof textoCompletoInput === 'object' && 'texto' in textoCompletoInput
      ? textoCompletoInput.texto
      : String(textoCompletoInput || '');

  console.log(`\n🔍 [ANALYZER] === INÍCIO DA ANÁLISE ===`);
  console.log(`   - Edital ID: ${editalId}`);
  console.log(`   - Texto para análise: ${textoCompleto.length} caracteres`);
  console.log(`   - Modo: ${options?.modo || 'completo'}`);

  const editalOriginal = await getEditalPorId(editalId);

  if (!editalOriginal) {
    console.error(`❌ [ANALYZER] Edital ${editalId} não encontrado no banco.`);
    return null;
  }

  console.log(`✅ [ANALYZER] Edital ${editalId} encontrado (fonte: ${editalOriginal.fonteConteudo || 'não definida'}, status: ${editalOriginal.statusAnalise || 'não definido'})`);

  const modo: ModoAnalise = options?.modo ?? 'completo';
  console.log(`\n🤖 Analisando edital ${editalId} com IA (${textoCompleto.length} chars, modo=${modo})`);

  if (!apiKeyConfigurada()) {
    console.warn('⚠️ OPENAI_API_KEY não configurada');
    editalOriginal.statusAnalise = 'erro';
    editalOriginal.erroAnalise = mensagemErroAnalise('OPENAI_API_KEY não configurada');
    await saveEdital(editalOriginal);
    return editalOriginal;
  }

  const textoParaAnalise = textoCompleto.length > LIMITE_TEXTO
    ? textoCompleto.substring(0, LIMITE_TEXTO)
    : textoCompleto;

  try {
    // Modo simplificado: mantém fluxo original com OpenAI SDK direto
    if (modo === 'simplificado') {
      try {
        const openai = obterClienteOpenAI();
        const resultado = await executarPromptJSON(openai, promptAnaliseSimplificada(), textoParaAnalise);

        editalOriginal.analiseIA = {
          resumo: resultado.resumo || editalOriginal.analiseIA?.resumo || '',
          objetivo: resultado.objetivo || editalOriginal.analiseIA?.objetivo || '',
          requisitos: Array.isArray(resultado.pontosChave) ? resultado.pontosChave : editalOriginal.analiseIA?.requisitos || [],
          elegibilidade: editalOriginal.analiseIA?.elegibilidade || '',
          itensFinanciáveis: editalOriginal.analiseIA?.itensFinanciáveis || [],
          documentosNecessarios: editalOriginal.analiseIA?.documentosNecessarios || [],
          criteriosAvaliacao: editalOriginal.analiseIA?.criteriosAvaliacao || [],
          contatoEdital: editalOriginal.analiseIA?.contatoEdital,
          pontosFracos: Array.isArray(resultado.alertas) ? resultado.alertas : editalOriginal.analiseIA?.pontosFracos || [],
          scoreAdequacao: editalOriginal.analiseIA?.scoreAdequacao,
          secoesRequeridas: editalOriginal.analiseIA?.secoesRequeridas || []
        };

        editalOriginal.confiancaPorCampo = {
          ...editalOriginal.confiancaPorCampo,
          resumo: resultado?.confiancas?.resumo || 70,
          pontosChave: resultado?.confiancas?.pontosChave || 65
        };

        editalOriginal.statusAnalise = 'analisado';
        editalOriginal.erroAnalise = '';
        editalOriginal.statusRevisao = editalOriginal.statusRevisao || 'pendente';
        editalOriginal.ultimaAnalise = new Date();

        validarCamposEdital(editalOriginal);
        await saveEdital(editalOriginal);
        return editalOriginal;
      } catch (erroSimplificado) {
        console.warn('⚠️ Erro na análise simplificada:', erroSimplificado);

        await logger.logError(
          `Falha na análise simplificada: ${(erroSimplificado as Error).message}`,
          'analise_ia',
          'retry',
          {
            modo: 'simplificado',
            editalId,
            textoLength: textoParaAnalise.length
          }
        );

        editalOriginal.statusAnalise = 'erro';
        editalOriginal.erroAnalise = mensagemErroAnalise(erroSimplificado);
        await saveEdital(editalOriginal);
        return editalOriginal;
      }
    }

    // Modo completo: schema unificado via LangChain (1 chamada em vez de 3)
    try {
      const resultado = await analisarComSchemaUnificado(textoParaAnalise);
      mapearParaEdital(editalOriginal, resultado);

      editalOriginal.statusAnalise = 'analisado';
        editalOriginal.erroAnalise = '';
      editalOriginal.statusRevisao = editalOriginal.statusRevisao || 'pendente';
      editalOriginal.ultimaAnalise = new Date();

      validarCamposEdital(editalOriginal);
      await saveEdital(editalOriginal);
      return editalOriginal;
    } catch (erroAnalise: any) {
      const isRateLimit = erroAnalise.message?.includes('rate_limit') || erroAnalise.message?.includes('429');
      const isTimeout = erroAnalise.message?.includes('timeout') || erroAnalise.message?.includes('ETIMEDOUT');
      const isOpenAIError = erroAnalise.message?.includes('OpenAI') || erroAnalise.message?.includes('api.openai');

      console.error('❌ Erro ao analisar edital com IA:', erroAnalise);

      await logger.logError(
        `Falha na análise completa: ${erroAnalise.message}`,
        isRateLimit ? 'rate_limit' : isTimeout ? 'timeout' : isOpenAIError ? 'api_openai' : 'analise_ia',
        isRateLimit ? 'retry' : 'human_review',
        {
          modo: 'completo',
          editalId,
          textoLength: textoParaAnalise.length
        }
      );

      editalOriginal.statusAnalise = 'erro';
      editalOriginal.erroAnalise = mensagemErroAnalise(erroAnalise);
      await saveEdital(editalOriginal);
      return editalOriginal;
    }
  } catch (erro) {
    console.error('❌ Erro ao analisar edital com IA:', erro);
    editalOriginal.statusAnalise = 'erro';
    editalOriginal.erroAnalise = mensagemErroAnalise(erro);
    await saveEdital(editalOriginal);
    return editalOriginal;
  }
}
