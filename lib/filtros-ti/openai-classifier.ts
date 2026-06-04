import axios from 'axios';
import { TecnologiaFoco, TipoFerramenta } from './enums';
import { cacheValidacao, gerarChaveCache, CACHE_TTL } from './cache';
import { loadCategorias } from '../scraper/filtros/loaders';

export type AiClassificationResult =
  | {
      ok: true;
      válido: boolean;
      tecnologia: TecnologiaFoco;
      categoria: TecnologiaFoco;
      tipo: TipoFerramenta;
      tipoFerramenta: TipoFerramenta;
      score: number;
      confiança: number;
      confianca: number;
      razão: string;
      usouCache: boolean;
      modelo: string;
    }
  | {
      ok: false;
      válido: false;
      erroTipo: 'timeout' | 'rate_limit' | 'auth' | 'parse' | 'unknown';
      mensagem: string;
      modelo: string;
    };

export async function validarComOpenAI(
  titulo: string,
  descricao: string,
  valor?: string,
  orgao?: string,
  termosBranco?: string[],
  tipoEdital?: string
): Promise<AiClassificationResult> {
  const modelo = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  try {
    const chaveCache = gerarChaveCache(titulo, descricao);

    const cacheEntry = cacheValidacao.get(chaveCache);
    if (cacheEntry && Date.now() - cacheEntry.timestamp < CACHE_TTL) {
      console.log(`   Cache hit: ${titulo.substring(0, 40)}...`);
      return { ...cacheEntry.data, ok: true, usouCache: true, modelo };
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      console.warn(`   OPENAI_API_KEY não configurada.`);
      return {
        ok: false,
        válido: false,
        erroTipo: 'auth',
        mensagem: 'OPENAI_API_KEY não configurada',
        modelo
      };
    }

    const termosBrancoStr = termosBranco?.join(', ') || 'nenhum';

    const tipoEditalInfo = tipoEdital === 'evento_cientifico'
      ? '\n\nNOTA: Este é um EVENTO CIENTÍFICO (congresso, conferência, seminário, workshop, etc). Avaliar se é relevante para ciência, tecnologia e inovação.'
      : '';

    const prompt = `Você é um especialista em validação de editais e chamadas públicas voltados para:
1. Pesquisa e Desenvolvimento em TI e Software
2. Soluções tecnológicas para Universidades Públicas e Privadas
3. Institutos Federais de Educação Tecnológica
4. Pesquisadores e Inovação Tecnológica
5. Eventos Científicos (congressos, conferências, seminários, workshops)
 
EDITAL PARA VALIDAÇÃO:
Título: ${titulo}
Descrição: ${descricao}
Valor: ${valor || 'N/A'}
Órgão: ${orgao || 'N/A'}
Palavras-chave encontradas: ${termosBrancoStr}${tipoEditalInfo}

TAREFAS:
1. Determine se este edital/chamada/evento é RELEVANTE para:
   - TI, Software e Desenvolvimento de Soluções
   - Pesquisa científica e acadêmica
   - Universidades (públicas ou privadas)
   - Institutos Federais de Educação Tecnológica
   - Inovação e desenvolvimento tecnológico
   - Eventos Científicos em Ciência, Tecnologia e Inovação

2. Se SIM (válido=true), categorize em UMA das áreas:
   - IA & Machine Learning
   - Big Data & Analytics
   - Cloud Computing
   - Segurança & Criptografia
   - DevOps & Infraestrutura
   - Web & Mobile
   - Blockchain & Web3
   - Computação Quântica
   - IoT & Sistemas Embarcados
   - Data Science
   - Linguagens & Compiladores
   - Pesquisa Acadêmica
   - Desenvolvimento de Soluções
   - Inovação Tecnológica
   - Educação Digital
   - Transformação Digital
   - Evento Científico
   - Outro - TI Geral

3. Categorize o TIPO de ferramenta:
   - Framework
   - Linguagem de Programação
   - Banco de Dados
   - IDE/Editor
   - Plataforma
   - Biblioteca/Pacote
   - Ferramenta de Desenvolvimento
   - Solução Corporativa
   - Sistema Educacional
   - Outro

4. Score de 0-100 (relevância para TI/Pesquisa/Academia)
5. Nível de confiança 0-100%
6. Se NÃO relevante, explique o motivo

RESPONDA EM JSON VÁLIDO (sem markdown, sem explicação adicional):
{
  "válido": true/false,
  "tecnologia": "categoria exata",
  "tipo": "tipo exato",
  "score": número,
  "confiança": número,
  "razão": "explicação breve"
}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: modelo,
        messages: [
          {
            role: 'system',
            content: 'Você é um especialista em validação de editais de pesquisa em TI. Responda SEMPRE em JSON válido sem markdown.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 300,
        response_format: { type: 'json_object' }
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal as any
      }
    );

    clearTimeout(timeoutId);

    const content = response.data.choices?.[0]?.message?.content || '';

    if (!content || content.trim().length === 0) {
      return {
        ok: false,
        válido: false,
        erroTipo: 'parse',
        mensagem: 'Resposta OpenAI vazia.',
        modelo
      };
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return {
        ok: false,
        válido: false,
        erroTipo: 'parse',
        mensagem: 'Resposta OpenAI sem JSON no conteúdo.',
        modelo
      };
    }

    let resultado;
    try {
      resultado = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      return {
        ok: false,
        válido: false,
        erroTipo: 'parse',
        mensagem: `JSON inválido retornado: ${(parseError as Error).message}`,
        modelo
      };
    }

    const objetoResultado: Record<string, any> = resultado && typeof resultado === 'object' ? resultado : {};

    const pegarCampo = (chaves: string[]): any => {
      for (const chave of chaves) {
        if (objetoResultado[chave] !== undefined && objetoResultado[chave] !== null) {
          return objetoResultado[chave];
        }
      }
      return undefined;
    };

    const camposAjustados = new Set<string>();

    const brutoValido = pegarCampo(['válido', 'valido', 'is_valid', 'isValido', 'is_valido', 'aprovado']);
    let validoNormalizado: boolean;
    if (typeof brutoValido === 'boolean') {
      validoNormalizado = brutoValido;
    } else if (typeof brutoValido === 'string') {
      const valStr = brutoValido.trim().toLowerCase();
      validoNormalizado = ['true', 'sim', 'yes', 'válido', 'valido'].includes(valStr);
    } else if (typeof brutoValido === 'number') {
      validoNormalizado = brutoValido > 0;
    } else {
      camposAjustados.add('válido');
      validoNormalizado = true;
    }

    const brutoTecnologia = pegarCampo(['tecnologia', 'categoria', 'área', 'area', 'categoria_tecnologia', 'categoriaTecnologia']);
    let tecnologiaNormalizada = '';

    if (typeof brutoTecnologia === 'string' && brutoTecnologia.trim().length > 0) {
      tecnologiaNormalizada = brutoTecnologia.trim();
    } else {
      camposAjustados.add('tecnologia');
      const tecnologiaInferida = inferirTecnologiaPorContexto(titulo, descricao, termosBranco);
      tecnologiaNormalizada = tecnologiaInferida || 'Outro - Computação';
    }

    const brutoTipo = pegarCampo(['tipo', 'tipoFerramenta', 'classificacao', 'classificação', 'categoria_tipo']);
    let tipoNormalizado = '';

    if (typeof brutoTipo === 'string' && brutoTipo.trim().length > 0) {
      tipoNormalizado = brutoTipo.trim();
    } else {
      camposAjustados.add('tipo');
      const tipoInferido = inferirTipoFerramentaPorContexto(titulo, descricao);
      tipoNormalizado = tipoInferido || 'Outro';
    }

    const brutoScore = pegarCampo(['score', 'relevancia', 'relevância', 'nota', 'pontuacao', 'pontuação']);
    let scoreNormalizado = Number.parseFloat(String(brutoScore));
    if (Number.isNaN(scoreNormalizado)) {
      camposAjustados.add('score');
      scoreNormalizado = 60;
    }

    const brutoConfianca = pegarCampo(['confiança', 'confianca', 'confidence', 'certeza', 'probabilidade']);
    let confiancaNormalizada = Number.parseFloat(String(brutoConfianca));
    if (Number.isNaN(confiancaNormalizada)) {
      camposAjustados.add('confiança');
      confiancaNormalizada = 60;
    }

    const brutoRazao = pegarCampo(['razão', 'razao', 'motivo', 'justificativa', 'observacao', 'observação']);
    let razaoNormalizada = typeof brutoRazao === 'string' && brutoRazao.trim().length > 0
      ? brutoRazao.trim()
      : 'Validação OpenAI';

    const camposRestantes = Array.from(camposAjustados);

    if (camposRestantes.length > 0) {
      const motivoPadrao = `Campos preenchidos automaticamente: ${camposRestantes.join(', ')}`;
      if (!objetoResultado.razão && razaoNormalizada === 'Validação OpenAI') {
        razaoNormalizada = motivoPadrao;
      }
      console.warn(`   Resposta OpenAI com campos faltantes (${camposRestantes.join(', ')}). Valores padrão aplicados.`);
    }

    const tecnologia = normalizarTecnologia((objetoResultado.tecnologia ?? tecnologiaNormalizada) as string);
    const tipo = normalizarTipo((objetoResultado.tipo ?? tipoNormalizado) as string);

    const resultadoFinal = {
      válido: validoNormalizado,
      tecnologia,
      categoria: tecnologia,
      tipo,
      tipoFerramenta: tipo,
      score: Math.min(100, Math.max(0, scoreNormalizado)),
      razão: razaoNormalizada,
      confiança: Math.min(100, Math.max(0, confiancaNormalizada)),
      confianca: Math.min(100, Math.max(0, confiancaNormalizada)),
      usouCache: false
    };

    cacheValidacao.set(chaveCache, {
      data: resultadoFinal,
      timestamp: Date.now()
    });

    return { ...resultadoFinal, ok: true, modelo };

  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn(`   Timeout OpenAI (>10s).`);
      return {
        ok: false,
        válido: false,
        erroTipo: 'timeout',
        mensagem: 'OpenAI API request timed out (>10s)',
        modelo
      };
    }

    const isRateLimit = axios.isAxiosError(error) && error.response?.status === 429;
    const isAuth = axios.isAxiosError(error) && error.response?.status === 401;

    console.error(`   Erro na OpenAI: ${error.message}`);
    return {
      ok: false,
      válido: false,
      erroTipo: isRateLimit ? 'rate_limit' : isAuth ? 'auth' : 'unknown',
      mensagem: error.message || 'Erro desconhecido na classificação',
      modelo
    };
  }
}

export function gerarFallbackAceitar(titulo: string): {
  válido: boolean;
  tecnologia: TecnologiaFoco;
  tipo: TipoFerramenta;
  score: number;
  razão: string;
  confiança: number;
  usouCache: boolean;
} {
  return {
    válido: true,
    tecnologia: TecnologiaFoco.OUTRO_COMPUTACAO,
    tipo: TipoFerramenta.OUTRO,
    score: 50,
    razão: 'Fallback: OpenAI falhou. Aceito conservadoramente.',
    confiança: 30,
    usouCache: false
  };
}

export function inferirTecnologiaPorContexto(
  titulo: string,
  descricao: string,
  termosBranco?: string[]
): TecnologiaFoco | null {
  const texto = `${titulo} ${descricao}`.toLowerCase();
  const termos = new Set((termosBranco || []).map((t) => t.toLowerCase()));

  const categorias = loadCategorias();
  const contem = (palavra: string) => texto.includes(palavra) || termos.has(palavra);

  for (const regra of categorias.regrasInferenciaTecnologia) {
    if (regra.palavras.some(contem)) {
      return regra.categoria as TecnologiaFoco;
    }
  }

  return null;
}

export function inferirTipoFerramentaPorContexto(
  titulo: string,
  descricao: string
): TipoFerramenta | null {
  const texto = `${titulo} ${descricao}`.toLowerCase();
  const categorias = loadCategorias();

  for (const regra of categorias.regrasInferenciaTipo) {
    if (regra.palavras.some((palavra) => texto.includes(palavra))) {
      return regra.tipo as TipoFerramenta;
    }
  }

  return null;
}

export function normalizarTecnologia(tech: string): TecnologiaFoco {
  const categorias = loadCategorias();
  const mapa = categorias.normalizacaoTecnologia;
  const chave = tech.toLowerCase();
  const normalizado = mapa[chave];
  return (normalizado as TecnologiaFoco) || TecnologiaFoco.OUTRO_COMPUTACAO;
}

export function normalizarTipo(tipo: string): TipoFerramenta {
  const categorias = loadCategorias();
  const mapa = categorias.normalizacaoTipo;
  const chave = tipo.toLowerCase();
  const normalizado = mapa[chave];
  return (normalizado as TipoFerramenta) || TipoFerramenta.OUTRO;
}

export function calcularScoreFinal(
  whitelistScore: number,
  iaScore: number,
  termoEncontrados: number
): number {
  const normTermos = Math.min(100, termoEncontrados * 25);
  const final = (whitelistScore * 0.3) + (iaScore * 0.6) + (normTermos * 0.1);
  return Math.round(final);
}