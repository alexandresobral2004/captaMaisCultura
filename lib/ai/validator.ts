import { Edital } from '../db/editais-store';

export interface ErroValidacao {
  campo: string;
  tipo: 'ERRO' | 'AVISO';
  mensagem: string;
  valor?: any;
  sugestao?: string;
}

export interface ResultadoValidacao {
  ehValido: boolean;
  erros: ErroValidacao[];
  avisos: ErroValidacao[];
  totalProblemas: number;
  confiancaGeral: number; // 0-100
}

/**
 * Valida um edital completo verificando coerência de dados
 */
export function validarCamposEdital(edital: Edital): ResultadoValidacao {
  const erros: ErroValidacao[] = [];
  const avisos: ErroValidacao[] = [];

  // 1. VALIDAÇÕES DE DATA
  erros.push(...validarDatas(edital));

  // 2. VALIDAÇÕES DE VALORES
  erros.push(...validarValores(edital));
  avisos.push(...validarValoresAvisos(edital));

  // 3. VALIDAÇÕES DE COMPLETUDE
  avisos.push(...validarCompletude(edital));

  // 4. VALIDAÇÕES DE CONFIANÇA IA
  avisos.push(...validarConfiancaIA(edital));

  // 5. VALIDAÇÕES DE COERÊNCIA
  erros.push(...validarCoerencia(edital));

  // Calcular confiança geral
  const confiancaGeral = calcularConfiancaGeral(edital, erros.length, avisos.length);

  return {
    ehValido: erros.length === 0,
    erros,
    avisos,
    totalProblemas: erros.length + avisos.length,
    confiancaGeral
  };
}

/**
 * Validações de DATAS
 */
function validarDatas(edital: Edital): ErroValidacao[] {
  const erros: ErroValidacao[] = [];
  const agora = new Date();

  // Validar dataLimite
  if (edital.dataLimite) {
    const dataLimite = new Date(edital.dataLimite);

    if (isNaN(dataLimite.getTime())) {
      erros.push({
        campo: 'dataLimite',
        tipo: 'ERRO',
        mensagem: 'Formato de data inválido',
        valor: edital.dataLimite,
        sugestao: 'Use formato DD/MM/YYYY'
      });
    } else if (dataLimite < agora) {
      erros.push({
        campo: 'dataLimite',
        tipo: 'ERRO',
        mensagem: 'Data limite está no passado',
        valor: edital.dataLimite,
        sugestao: 'Verifique se a data foi extraída corretamente'
      });
    }
  } else {
    erros.push({
      campo: 'dataLimite',
      tipo: 'ERRO',
      mensagem: 'Campo obrigatório ausente',
      sugestao: 'Data limite é obrigatória em editais'
    });
  }

  // Validar datas publicação e resultado (se existem)
  if (edital.dataPublicacao) {
    const dataPub = new Date(edital.dataPublicacao);
    if (isNaN(dataPub.getTime())) {
      erros.push({
        campo: 'dataPublicacao',
        tipo: 'AVISO',
        mensagem: 'Formato de data de publicação inválido'
      });
    }
  }

  if (edital.dataResultado) {
    const dataRes = new Date(edital.dataResultado);
    if (isNaN(dataRes.getTime())) {
      erros.push({
        campo: 'dataResultado',
        tipo: 'AVISO',
        mensagem: 'Formato de data de resultado inválido'
      });
    }
  }

  // Validar sequência: publicação < limite < resultado
  if (edital.dataPublicacao && edital.dataLimite && edital.dataResultado) {
    const dataPub = new Date(edital.dataPublicacao);
    const dataLim = new Date(edital.dataLimite);
    const dataRes = new Date(edital.dataResultado);

    if (dataPub > dataLim) {
      erros.push({
        campo: 'datas',
        tipo: 'ERRO',
        mensagem: 'Data de publicação é posterior à data limite',
        sugestao: 'Verifique a ordem das datas'
      });
    }

    if (dataLim > dataRes) {
      erros.push({
        campo: 'datas',
        tipo: 'AVISO',
        mensagem: 'Data limite é posterior à data de resultado'
      });
    }
  }

  return erros;
}

/**
 * Validações de VALORES (erros críticos)
 */
function validarValores(edital: Edital): ErroValidacao[] {
  const erros: ErroValidacao[] = [];

  const valorMin = edital.valorMin;
  const valorMax = edital.valorMax;

  // Se ambos existem, validar coerência
  if (valorMin !== undefined && valorMax !== undefined) {
    if (valorMin < 0 || valorMax < 0) {
      erros.push({
        campo: 'valores',
        tipo: 'ERRO',
        mensagem: 'Valores não podem ser negativos',
        valor: { valorMin, valorMax },
        sugestao: 'Verifique se houve erro na extração'
      });
    }

    if (valorMin > valorMax) {
      erros.push({
        campo: 'valores',
        tipo: 'ERRO',
        mensagem: 'Valor mínimo é maior que valor máximo',
        valor: { valorMin, valorMax },
        sugestao: 'Revise os valores ou corrija a ordem'
      });
    }

    // Verificar se os valores são razoáveis
    const diferenca = valorMax - valorMin;
    const percentualDif = (diferenca / valorMin) * 100;

    if (percentualDif > 10000) {
      erros.push({
        campo: 'valores',
        tipo: 'AVISO',
        mensagem: 'Diferença entre valor mín e máx é muito grande (>10000%)',
        sugestao: 'Verifique se um dos valores foi extraído incorretamente'
      });
    }
  }

  return erros;
}

/**
 * Validações de VALORES (avisos e sugestões)
 */
function validarValoresAvisos(edital: Edital): ErroValidacao[] {
  const avisos: ErroValidacao[] = [];

  // Aviso se valores estão muito altos ou muito baixos
  if (edital.valorMin !== undefined) {
    if (edital.valorMin < 1000) {
      avisos.push({
        campo: 'valorMin',
        tipo: 'AVISO',
        mensagem: 'Valor mínimo é muito baixo (< R$ 1.000)',
        sugestao: 'Verifique se foi extraído em centavos ou em outra moeda'
      });
    }

    if (edital.valorMin > 1000000000) {
      avisos.push({
        campo: 'valorMin',
        tipo: 'AVISO',
        mensagem: 'Valor mínimo é muito alto (> R$ 1 bilhão)',
        sugestao: 'Verifique se há zeros extras ou erro na extração'
      });
    }
  }

  return avisos;
}

/**
 * Validações de COMPLETUDE (campos importantes que estão vazios)
 */
function validarCompletude(edital: Edital): ErroValidacao[] {
  const avisos: ErroValidacao[] = [];

  // Campos que devem ter conteúdo
  const camposImportantes = [
    { campo: 'titulo', minChars: 10 },
    { campo: 'descricao', minChars: 50 },
    { campo: 'objetivo', minChars: 20 }
  ];

  for (const { campo, minChars } of camposImportantes) {
    const valor = edital[campo as keyof Edital] as string | undefined;

    if (!valor || valor.trim().length === 0) {
      avisos.push({
        campo,
        tipo: 'AVISO',
        mensagem: `Campo "${campo}" está vazio`,
        sugestao: 'Preencha manualmente ou reanalise o PDF'
      });
    } else if (valor.length < minChars) {
      avisos.push({
        campo,
        tipo: 'AVISO',
        mensagem: `Campo "${campo}" está muito curto (${valor.length} chars, mín ${minChars})`,
        sugestao: 'Considere reextrair do PDF ou enriquecer manualmente'
      });
    }
  }

  // Aviso se faltam áreas temáticas
  if (!edital.areasTematicas || edital.areasTematicas.length === 0) {
    avisos.push({
      campo: 'areasTematicas',
      tipo: 'AVISO',
      mensagem: 'Nenhuma área temática foi identificada',
      sugestao: 'Adicione manualmente as áreas de foco do edital'
    });
  }

  return avisos;
}

/**
 * Validações de CONFIANÇA IA (avisos sobre campos com baixa confiança)
 */
function validarConfiancaIA(edital: Edital): ErroValidacao[] {
  const avisos: ErroValidacao[] = [];

  if (!edital.confiancaPorCampo) {
    return avisos;
  }

  const confiancaMinima = 70; // 70% de confiança mínima aceitável

  for (const [campo, confianca] of Object.entries(edital.confiancaPorCampo)) {
    if (typeof confianca === 'number' && confianca < confiancaMinima) {
      avisos.push({
        campo,
        tipo: 'AVISO',
        mensagem: `Campo "${campo}" foi extraído com baixa confiança (${confianca}%)`,
        valor: edital[campo as keyof Edital],
        sugestao: 'Revise e corrija este campo manualmente'
      });
    }
  }

  // Aviso especial para classificação
  if (edital.confiancaClassificacao && edital.confiancaClassificacao < 80) {
    avisos.push({
      campo: 'classificacao',
      tipo: 'AVISO',
      mensagem: `Este item foi classificado como edital com apenas ${edital.confiancaClassificacao}% de confiança`,
      sugestao: 'Verifique se realmente é um edital válido'
    });
  }

  return avisos;
}

/**
 * Validações de COERÊNCIA (dados que fazem sentido juntos)
 */
function validarCoerencia(edital: Edital): ErroValidacao[] {
  const erros: ErroValidacao[] = [];

  // Se é para startups, provavelmente não deveria ter requisitos muito altos
  if (edital.descricao?.toLowerCase().includes('startup')) {
    if (edital.tipoProponente?.includes('Universidade')) {
      erros.push({
        campo: 'coerencia',
        tipo: 'AVISO',
        mensagem: 'Edital para "startup" mas aceita "Universidade" como proponente',
        sugestao: 'Verifique se esta é realmente uma chamada para startups'
      });
    }
  }

  // Se tem valor muito baixo, provavelmente é bolsa ou pequeno projeto
  if (edital.valorMax && edital.valorMax < 10000) {
    if (edital.descricao?.toLowerCase().includes('grande empresa')) {
      erros.push({
        campo: 'coerencia',
        tipo: 'AVISO',
        mensagem: 'Valor muito baixo para "grandes empresas"',
        sugestao: 'Verifique o público-alvo do edital'
      });
    }
  }

  return erros;
}

/**
 * Calcula score de confiança geral do edital
 */
function calcularConfiancaGeral(edital: Edital, numErros: number, numAvisos: number): number {
  let confianca = 100;

  // Penalidade por erros (cada erro = -20 pontos)
  confianca -= numErros * 20;

  // Penalidade por avisos (cada aviso = -5 pontos)
  confianca -= numAvisos * 5;

  // Bônus se tem alta confiança da IA
  if (edital.confiancaClassificacao) {
    confianca = (confianca + edital.confiancaClassificacao) / 2;
  }

  // Calcular média de confiança dos campos
  if (edital.confiancaPorCampo) {
    const confiancas = Object.values(edital.confiancaPorCampo).filter((c) => typeof c === 'number') as number[];
    if (confiancas.length > 0) {
      const mediaConfianca = confiancas.reduce((a, b) => a + b, 0) / confiancas.length;
      confianca = (confianca + mediaConfianca) / 2;
    }
  }

  // Garantir que fica entre 0 e 100
  return Math.max(0, Math.min(100, Math.round(confianca)));
}

/**
 * Valida um campo específico contra regras customizadas
 */
export function validarCampoEspecifico(
  nomeCampo: string,
  valor: any,
  regras: Array<{
    tipo: 'OBRIGATORIO' | 'FORMATO' | 'RANGE' | 'ENUM' | 'CUSTOM';
    parametros?: any;
    mensagem: string;
  }>
): ErroValidacao[] {
  const erros: ErroValidacao[] = [];

  for (const regra of regras) {
    switch (regra.tipo) {
      case 'OBRIGATORIO':
        if (!valor || (typeof valor === 'string' && valor.trim().length === 0)) {
          erros.push({
            campo: nomeCampo,
            tipo: 'ERRO',
            mensagem: `${nomeCampo} é obrigatório`,
            sugestao: regra.mensagem
          });
        }
        break;

      case 'FORMATO':
        if (valor && !new RegExp(regra.parametros.regex).test(String(valor))) {
          erros.push({
            campo: nomeCampo,
            tipo: 'ERRO',
            mensagem: `${nomeCampo} não corresponde ao formato esperado`,
            valor,
            sugestao: regra.mensagem
          });
        }
        break;

      case 'RANGE':
        if (typeof valor === 'number') {
          const { min, max } = regra.parametros;
          if (valor < min || valor > max) {
            erros.push({
              campo: nomeCampo,
              tipo: 'ERRO',
              mensagem: `${nomeCampo} está fora do intervalo permitido (${min}-${max})`,
              valor,
              sugestao: regra.mensagem
            });
          }
        }
        break;

      case 'ENUM':
        if (!regra.parametros.opcoes.includes(valor)) {
          erros.push({
            campo: nomeCampo,
            tipo: 'ERRO',
            mensagem: `${nomeCampo} contém valor inválido`,
            valor,
            sugestao: `Valores válidos: ${regra.parametros.opcoes.join(', ')}`
          });
        }
        break;
    }
  }

  return erros;
}

/**
 * Retorna um "health score" do edital (0-100)
 * Usado para priorizar qual edital revisar primeiro
 */
export function calcularHealthScore(edital: Edital): number {
  const validacao = validarCamposEdital(edital);

  let score = 100;

  // Penalidade por problemas
  score -= validacao.erros.length * 15;
  score -= validacao.avisos.length * 3;

  // Bônus por completude
  const campos = ['titulo', 'descricao', 'dataLimite', 'valor', 'objetivo'];
  const preenchidos = campos.filter((c) => edital[c as keyof Edital]).length;
  score += (preenchidos / campos.length) * 20;

  return Math.max(0, Math.min(100, score));
}
