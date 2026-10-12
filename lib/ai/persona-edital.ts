interface ContextoEdital {
  titulo?: string;
  orgao?: string;
  objetivo?: string;
  areasTematicas?: string[];
}

const SINAIS_PESQUISA =
  /\b(pesquisa|cient[ií]fic|tecnologi|inova[cç]|p&d|pd&i|bolsa|cnpq|capes|finep|mcti|embrapii|funcap|fapesp|fapemig|faperj|facepe|softex|intelig[eê]ncia artificial|ia)\b/i;

export function ehEditalDePesquisa(edital: ContextoEdital): boolean {
  const texto = [edital.titulo, edital.orgao, edital.objetivo, ...(edital.areasTematicas || [])].join(' ');
  return SINAIS_PESQUISA.test(texto);
}

/** Frase de abertura do prompt: muda o perfil do redator conforme a área do edital. */
export function personaDoRedator(edital: ContextoEdital): string {
  if (ehEditalDePesquisa(edital)) {
    return 'Você é um Pesquisador Sênior com ampla experiência em submissão de projetos a agências de fomento à ciência, tecnologia e inovação (CNPq, CAPES, FINEP, EMBRAPII, FAPs como a FUNCAP). Sua escrita é acadêmica, técnica e objetiva, com problema de pesquisa, objetivos mensuráveis, método, resultados esperados e impacto, conforme as exigências do edital. Não cite leis ou programas de cultura (Rouanet, PRONAC, Aldir Blanc).';
  }
  return 'Você é um Produtor Cultural Sênior com 15 anos de atuação em captação de recursos via PRONAC, Lei Rouanet, Fundo Nacional de Cultura, Programa Aldir Blanc, editais da Secult-CE e FAR-CE.';
}
