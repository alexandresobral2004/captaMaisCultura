/**
 * EXTRATOR DE DADOS ESTRUTURADOS DE EDITAIS
 * 
 * Extrai informações principais do edital usando IA (modo simplificado)
 * e salva no banco de dados em formato estruturado.
 * 
 * Dados extraídos:
 * - Resumo e objetivo
 * - Datas principais
 * - Valores e financiamento
 * - Requisitos e elegibilidade
 * - Cronograma
 */

import OpenAI from 'openai';
import { ResultadoValidacaoKeywords } from './keyword-map';

const MODELO_PADRAO = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const LIMITE_TEXTO = 30000; // Limite menor para resumo

/**
 * Interface para dados extraídos do edital
 */
export interface DadosEditaisExtraidos {
  // Identificação
  titulo: string;
  resumo: string;
  objetivo: string;

  // Datas importantes
  datas: {
    publicacao?: string;
    abertura?: string;
    encerramento?: string;
    resultado?: string;
  };

  // Aspectos financeiros
  financeiro: {
    valorTotal?: string;
    valorMin?: number;
    valorMax?: number;
    moeda?: string;
    tipo?: string; // bolsa, auxílio, repasse, etc
  };

  // Elegibilidade
  elegibilidade: {
    tiposProponentes: string[];
    requisitosMinimos: string[];
    restricoes?: string[];
    abrangencia?: string;
  };

  // Cronograma resumido
  cronograma: string;

  // Metadados da extração
  confiancaExtracao: number; // 0-100%
  metodosUsados: string[]; // "keywords", "ia", "heuristica"
  errosExtracao?: string[];
}

/**
 * Extrai dados principais de um edital usando IA simplificada
 * 
 * @param textoCompletoInput - Texto do PDF ou conteúdo HTML
 * @param validacaoKeywords - Resultado da validação com keywords
 * @param titulo - Título do edital para contexto
 * @returns Dados estruturados extraídos
 */
export async function extrairDadosEditais(
  textoCompletoInput: string | any,
  validacaoKeywords: ResultadoValidacaoKeywords,
  titulo?: string
): Promise<DadosEditaisExtraidos> {
  // Normalizar entrada
  const textoCompleto = typeof textoCompletoInput === 'string'
    ? textoCompletoInput
    : textoCompletoInput && typeof textoCompletoInput === 'object' && 'texto' in textoCompletoInput
      ? textoCompletoInput.texto
      : String(textoCompletoInput || '');

  const apiKey = process.env.OPENAI_API_KEY;
  const erros: string[] = [];
  const metodos: string[] = ['keywords'];

  // Dados básicos padrão
  const dadosBasicos: DadosEditaisExtraidos = {
    titulo: titulo || 'Edital Sem Título',
    resumo: '',
    objetivo: '',
    datas: {},
    financeiro: {},
    elegibilidade: {
      tiposProponentes: [],
      requisitosMinimos: [],
      abrangencia: 'Nacional'
    },
    cronograma: '',
    confiancaExtracao: validacaoKeywords.confianca,
    metodosUsados: metodos,
    errosExtracao: erros
  };

  // Se não tiver API key, usar apenas keywords
  if (!apiKey) {
    console.warn('⚠️ OPENAI_API_KEY não configurada - usando apenas keywords');
    return extrairComKeywords(textoCompleto, dadosBasicos, validacaoKeywords);
  }

  // Tentar extração com IA
  try {
    const textoParaAnalise = textoCompleto.length > LIMITE_TEXTO
      ? textoCompleto.substring(0, LIMITE_TEXTO)
      : textoCompleto;

    const openai = new OpenAI({ apiKey });

    const systemPrompt = `Você é um especialista em extrair informações de editais brasileiros.
Analise o documento fornecido e extraia APENAS as informações solicitadas em formato JSON.
Se uma informação não estiver disponível, use null.
Responda APENAS com JSON válido, sem markdown ou explicações.`;

    const userContent = `Documento:\n${textoParaAnalise}

Extraia em JSON:
{
  "resumo": "resumo de 2-3 linhas do edital",
  "objetivo": "objetivo principal do edital",
  "dataEncerramento": "data de encerramento no formato DD/MM/YYYY ou null",
  "dataResultado": "data do resultado no formato DD/MM/YYYY ou null",
  "valorTotal": "valor total como string ou null",
  "tiposProponentes": ["array de tipos de entidades que podem participar"],
  "requisitosMinimos": ["array de requisitos obrigatórios"],
  "cronograma": "cronograma resumido em 2-3 linhas",
  "confianca": 0-100
}`;

    const response = await openai.chat.completions.create({
      model: MODELO_PADRAO,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ],
      temperature: 0.1
    });

    const content = response.choices[0]?.message?.content || '{}';
    const resultado = JSON.parse(content);

    metodos.push('ia');

    // Preencher com dados da IA
    if (resultado.resumo) dadosBasicos.resumo = resultado.resumo;
    if (resultado.objetivo) dadosBasicos.objetivo = resultado.objetivo;
    if (resultado.dataEncerramento) dadosBasicos.datas.encerramento = resultado.dataEncerramento;
    if (resultado.dataResultado) dadosBasicos.datas.resultado = resultado.dataResultado;
    if (resultado.valorTotal) dadosBasicos.financeiro.valorTotal = resultado.valorTotal;
    if (Array.isArray(resultado.tiposProponentes)) {
      dadosBasicos.elegibilidade.tiposProponentes = resultado.tiposProponentes;
    }
    if (Array.isArray(resultado.requisitosMinimos)) {
      dadosBasicos.elegibilidade.requisitosMinimos = resultado.requisitosMinimos;
    }
    if (resultado.cronograma) dadosBasicos.cronograma = resultado.cronograma;
    if (typeof resultado.confianca === 'number') {
      dadosBasicos.confiancaExtracao = Math.round(
        (dadosBasicos.confiancaExtracao + resultado.confianca) / 2
      );
    }

    console.log(`✅ Extração com IA concluída: ${Object.keys(resultado).length} campos`);
  } catch (erro) {
    console.error('⚠️ Erro na extração com IA:', erro);
    erros.push(`Erro IA: ${(erro as Error).message}`);
    // Continuar com keywords apenas
  }

  // Enriquecer com heurísticas de keywords
  if (validacaoKeywords.oportunidadesDetectadas.length > 0) {
    metodos.push('heuristica');
    if (validacaoKeywords.oportunidadesDetectadas.includes('bolsaIC')) {
      dadosBasicos.elegibilidade.tiposProponentes.push('Estudantes de Iniciação Científica');
    }
    if (validacaoKeywords.oportunidadesDetectadas.includes('bolsaPos')) {
      dadosBasicos.elegibilidade.tiposProponentes.push('Pesquisadores em Pós-Graduação');
    }
    if (validacaoKeywords.oportunidadesDetectadas.includes('editalPesquisa')) {
      if (!dadosBasicos.objetivo) {
        dadosBasicos.objetivo = 'Apoio a projetos de pesquisa científica e desenvolvimento tecnológico';
      }
    }
  }

  dadosBasicos.metodosUsados = metodos;
  dadosBasicos.errosExtracao = erros.length > 0 ? erros : undefined;

  return dadosBasicos;
}

/**
 * Extração usando apenas análise de keywords (sem IA)
 */
function extrairComKeywords(
  texto: string,
  dados: DadosEditaisExtraidos,
  validacao: ResultadoValidacaoKeywords
): DadosEditaisExtraidos {
  // Tentar encontrar padrões comuns
  
  // 1. Procurar por datas (padrão DD/MM/YYYY ou similares)
  const regexData = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/g;
  const datasEncontradas = texto.match(regexData);
  if (datasEncontradas && datasEncontradas.length > 0) {
    dados.datas.encerramento = datasEncontradas[datasEncontradas.length - 1]; // Última data
  }

  // 2. Procurar por valores monetários
  const regexValor = /R\$\s*([\d.,]+)/g;
  const valoresEncontrados = texto.match(regexValor);
  if (valoresEncontrados && valoresEncontrados.length > 0) {
    dados.financeiro.valorTotal = valoresEncontrados[0];
  }

  // 3. Usar oportunidades detectadas
  if (validacao.oportunidadesDetectadas.length > 0) {
    const tipos = validacao.oportunidadesDetectadas;
    if (tipos.includes('bolsaIC') || tipos.includes('bolsaPos')) {
      dados.elegibilidade.tiposProponentes.push('Pesquisadores');
    }
    if (tipos.includes('editalPesquisa')) {
      dados.objetivo = 'Edital de pesquisa e desenvolvimento';
    }
    if (tipos.includes('eventoCientifico')) {
      dados.objetivo = 'Evento científico/Congresso';
    }
  }

  // 4. Gerar resumo básico do texto
  const primeiras500Chars = texto.substring(0, 500);
  dados.resumo = primeiras500Chars.split('.')[0] + '.';

  return dados;
}

/**
 * Formata dados extraídos para exibição
 */
export function formatarDadosExtraidos(dados: DadosEditaisExtraidos): string {
  return `
📄 DADOS EXTRAÍDOS DO EDITAL

📋 Identificação:
   Título: ${dados.titulo}
   Objetivo: ${dados.objetivo || 'Não identificado'}
   Resumo: ${dados.resumo || 'Não identificado'}

📅 Datas Importantes:
   Encerramento: ${dados.datas.encerramento || 'Não informado'}
   Resultado: ${dados.datas.resultado || 'Não informado'}

💰 Financeiro:
   Valor Total: ${dados.financeiro.valorTotal || 'Não informado'}
   Tipo: ${dados.financeiro.tipo || 'Não especificado'}

👥 Elegibilidade:
   Proponentes: ${dados.elegibilidade.tiposProponentes.join(', ') || 'Não especificado'}
   Requisitos: ${dados.elegibilidade.requisitosMinimos.join(', ') || 'Não especificado'}
   Abrangência: ${dados.elegibilidade.abrangencia}

📆 Cronograma:
   ${dados.cronograma || 'Não informado'}

🎯 Qualidade da Extração:
   Confiança: ${dados.confiancaExtracao}%
   Métodos: ${dados.metodosUsados.join(', ')}
   ${dados.errosExtracao && dados.errosExtracao.length > 0 ? `Erros: ${dados.errosExtracao.join(', ')}` : ''}
  `;
}
