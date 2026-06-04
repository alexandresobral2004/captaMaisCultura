/**
 * Prompts especializados para extração de dados específicos de editais
 * Cada prompt é otimizado para extrair um campo ou grupo de campos
 */

export function promptExtrairDatas(): string {
  return `Você é um especialista em extrair datas de editais.
Analisando o texto do edital, extraia as seguintes datas em formato DD/MM/YYYY:

Responda APENAS com JSON válido:
{
  "dataPublicacao": "DD/MM/YYYY ou null",
  "dataAbertura": "DD/MM/YYYY ou null",
  "dataLimite": "DD/MM/YYYY ou null",
  "dataResultado": "DD/MM/YYYY ou null",
  "dataHomologacao": "DD/MM/YYYY ou null",
  "motivos": {
    "dataLimite": "onde foi encontrada ou razão se não encontrada"
  },
  "confiancas": {
    "dataLimite": 0-100,
    "dataPublicacao": 0-100,
    "dataAbertura": 0-100,
    "dataResultado": 0-100
  }
}`;
}

export function promptExtrairValores(): string {
  return `Você é um especialista em extrair informações financeiras de editais.
Analisando o texto do edital, extraia as seguintes informações sobre valores:

Responda APENAS com JSON válido:
{
  "valorMin": número ou null,
  "valorMax": número ou null,
  "valorString": "descrição do valor como aparece no edital ou null",
  "moeda": "BRL, USD, EUR, etc ou null",
  "unidade": "por projeto, por instituição, total, etc ou null",
  "repasseOuSubvencao": "repasse, subvenção, bolsa, etc ou null",
  "confiancas": {
    "valorMin": 0-100,
    "valorMax": 0-100,
    "valorString": 0-100
  },
  "observacoes": "notas sobre os valores extraídos"
}`;
}

export function promptExtrairElegibilidade(): string {
  return `Você é um especialista em extrair informações de elegibilidade de editais.
Analisando o texto do edital, extraia informações sobre quem pode participar:

Responda APENAS com JSON válido:
{
  "tiposProponentes": ["string array - tipos de entidades que podem se inscrever"],
  "requisitosMinimos": ["string array - requisitos obrigatórios"],
  "restricoes": ["string array - o que NÃO pode participar"],
  "abrangencia": "Nacional, Regional, Estadual, Municipal ou Outra",
  "focoGeografico": ["array de estados/regiões se aplicável"],
  "areasTematicas": ["array de áreas de foco do edital"],
  "tiposProjetoAdmitidos": ["array de tipos de projeto aceitos"],
  "confiancas": {
    "tiposProponentes": 0-100,
    "abrangencia": 0-100,
    "areasTematicas": 0-100
  }
}`;
}

export function promptExtrairDocumentos(): string {
  return `Você é um especialista em extrair listas de documentos de editais.
Analisando o texto do edital, extraia a lista de documentos necessários para submissão:

Responda APENAS com JSON válido:
{
  "documentosObrigatorios": ["string array - docs que DEVEM ser enviados"],
  "documentosOpcionais": ["string array - docs que são opcionais"],
  "documentosTecnicos": ["string array - documentos técnicos do projeto"],
  "documentosFiscais": ["string array - documentos de regularidade fiscal"],
  "documentosBancarios": ["string array - documentos bancários/financeiros"],
  "documentosProjeto": ["string array - documentação do projeto"],
  "totalDocumentos": número,
  "confianca": 0-100,
  "observacoes": "notas sobre documentos ou requerimentos especiais"
}`;
}

export function promptExtrairCriterios(): string {
  return `Você é um especialista em extrair critérios de avaliação de editais.
Analisando o texto do edital, extraia os critérios usados para avaliar e aprovar projetos:

Responda APENAS com JSON válido:
{
  "criteriosAvaliacao": ["string array - critérios de avaliação"],
  "pesos": {
    "criterio": "peso em % ou descrição"
  },
  "penalizacoes": ["string array - situações que resultam em reprovação"],
  "pontuacaoMinima": número ou null,
  "processoSeleção": "descrição do processo de seleção",
  "confianca": 0-100
}`;
}

export function promptAnaliseFinanceiraEDatas(): string {
  return `Você é um especialista em análise de editais e irá extrair datas e informações financeiras em uma única resposta.
Analise o texto fornecido e preencha o JSON abaixo de forma consistente. Valores e datas podem ser null se não encontrados.

Responda APENAS com JSON válido:
{
  "datas": {
    "publicacao": "DD/MM/YYYY ou null",
    "abertura": "DD/MM/YYYY ou null",
    "limite": "DD/MM/YYYY ou null",
    "resultado": "DD/MM/YYYY ou null",
    "observacoes": "string opcional"
  },
  "valores": {
    "valorMin": número ou null,
    "valorMax": número ou null,
    "valorReferencia": "descrição textual ou null",
    "moeda": "BRL, USD, etc ou null",
    "unidade": "por projeto, total, etc ou null",
    "observacoes": "string opcional"
  },
  "confiancas": {
    "datas": {
      "publicacao": 0-100,
      "limite": 0-100,
      "resultado": 0-100
    },
    "valores": {
      "valorMin": 0-100,
      "valorMax": 0-100,
      "valorReferencia": 0-100
    }
  }
}`;
}

export function promptAnaliseElegibilidadeEDocumentos(): string {
  return `Você é um especialista em análise de elegibilidade e documentação de editais.
Leia o texto do edital e devolva um JSON contendo os campos abaixo.

Responda APENAS com JSON válido:
{
  "elegibilidade": {
    "tiposProponentes": ["string"],
    "requisitos": ["string"],
    "restricoes": ["string"],
    "abrangencia": "Nacional, Regional, Estadual, Municipal ou Outra",
    "areasTematicas": ["string"],
    "focoGeografico": ["string"],
    "observacoes": "string opcional"
  },
  "documentos": {
    "obrigatorios": ["string"],
    "opcionais": ["string"],
    "tecnicos": ["string"],
    "fiscais": ["string"],
    "bancarios": ["string"],
    "totalDocumentos": número ou null
  },
  "confiancas": {
    "tiposProponentes": 0-100,
    "requisitos": 0-100,
    "documentos": 0-100
  }
}`;
}

export function promptAnaliseResumoECriterios(): string {
  return `Você é um especialista em resumir e validar editais.
Resuma os pontos principais, critérios de avaliação e faça um cheque de consistência.

Responda APENAS com JSON válido:
{
  "resumo": "Resumo de até 5 frases",
  "objetivo": "Objetivo principal do edital",
  "criterios": ["string"],
  "avaliacao": {
    "criteriosDetalhados": ["string"],
    "penalizacoes": ["string"],
    "pontuacaoMinima": número ou null
  },
  "contato": "Email/telefone se houver",
  "consistencia": {
    "status": "ok" | "dúvida" | "incompleto",
    "alertas": ["string"]
  },
  "confiancas": {
    "resumo": 0-100,
    "criterios": 0-100
  }
}`;
}

export function promptAnaliseSimplificada(): string {
  return `Você irá produzir uma análise simplificada do edital, focando em responder se vale acompanhar.
Responda APENAS com JSON válido:
{
  "resumo": "Resumo em até 3 frases",
  "objetivo": "Objetivo principal",
  "pontosChave": ["string"],
  "alertas": ["string"],
  "proximaAcao": "Sugestão de próximo passo",
  "confiancas": {
    "resumo": 0-100,
    "pontosChave": 0-100
  }
}`;
}

export function promptExtrairResumo(): string {
  return `Você é um especialista em resumir editais de forma concisa.
Analisando o texto do edital, crie um resumo focado (máximo 500 caracteres) com:
- O que é o edital
- Quem pode participar
- Qual é o objetivo principal
- Qual é o prazo limite

Responda APENAS com JSON válido:
{
  "resumo": "texto com até 500 caracteres",
  "objetivo": "1 frase descrevendo o objetivo principal",
  "publico": "descrição do público alvo",
  "beneficio": "qual é o benefício oferecido",
  "confianca": 0-100
}`;
}

export function promptValidarConsistencia(): string {
  return `Você é um especialista em validar dados extraídos de editais.
Recebendo os dados já extraídos, verifique se há inconsistências lógicas:

Responda APENAS com JSON válido:
{
  "ehConsistente": true ou false,
  "inconsistencias": [
    {
      "tipo": "ERRO ou AVISO",
      "campos": ["array de campos envolvidos"],
      "descricao": "descrição da inconsistência",
      "sugestao": "sugestão de correção"
    }
  ],
  "avisos": ["array de avisos ou campos suspeitos"],
  "confiancaGeral": 0-100
}`;
}

export function promptClassificarTecnologia(): string {
  return `Você é um especialista em tecnologia da informação e inovação.
Analisando um edital de fomento, classifique-o por foco tecnológico:

Responda APENAS com JSON válido:
{
  "temFocoTI": true ou false,
  "areasTecinologia": ["IA", "Cloud", "Blockchain", "IoT", "Big Data", "Cibersegurança", "Outra"],
  "ferramentasEsperadas": ["string array - tecnologias mencionadas"],
  "nivelTecnico": "Básico, Intermediário, Avançado",
  "confianca": 0-100,
  "motivo": "explicação da classificação"
}`;
}

/**
 * Cria um prompt para extrair um campo específico com contexto
 */
export function promptExtrairCampoEspecifico(
  nomeCampo: string,
  descricaoCampo: string,
  exemplos?: string[]
): string {
  let prompt = `Você é um especialista em análise de editais.
Extraia APENAS o campo "${nomeCampo}" do texto fornecido.

Descrição: ${descricaoCampo}`;

  if (exemplos && exemplos.length > 0) {
    prompt += `\n\nExemplos de valores esperados:\n`;
    exemplos.forEach((ex, i) => {
      prompt += `${i + 1}. ${ex}\n`;
    });
  }

  prompt += `\n\nResponda APENAS com JSON válido:
{
  "valor": "valor extraído ou null",
  "confianca": 0-100,
  "fonte": "trecho do documento onde foi encontrado ou null"
}`;

  return prompt;
}

/**
 * Cria um prompt para validar um campo específico
 */
export function promptValidarCampo(
  nomeCampo: string,
  valor: string,
  regras: string[]
): string {
  let prompt = `Você é um especialista em validação de dados de editais.
Valide o seguinte campo:

Campo: "${nomeCampo}"
Valor: "${valor}"

Regras de validação:
${regras.map((r, i) => `${i + 1}. ${r}`).join('\n')}

Responda APENAS com JSON válido:
{
  "isValido": true ou false,
  "erros": ["array de erros encontrados ou vazio"],
  "avisos": ["array de avisos ou vazio"],
  "sugestoes": ["array de sugestões de correção"],
  "confianca": 0-100
}`;

  return prompt;
}

/**
 * Prompt para perguntas customizadas sobre o edital
 */
export function promptPerguntaCustomizada(pergunta: string): string {
  return `Você é um especialista em análise de editais de fomento.
Respondendo com base no texto do edital fornecido, responda a seguinte pergunta:

"${pergunta}"

Responda APENAS com JSON válido:
{
  "resposta": "resposta concisa baseada no edital",
  "encontrado": true ou false (se a informação estava no documento),
  "confianca": 0-100,
  "fonte": "trecho do documento que suporta a resposta ou null"
}`;
}
