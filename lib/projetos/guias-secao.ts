import { ehEditalDePesquisa } from '../ai/persona-edital';

export type TipoSecao =
  | 'resumo' | 'justificativa' | 'objetivos' | 'metodologia' | 'cronograma'
  | 'orcamento' | 'resultados' | 'equipe' | 'acessibilidade' | 'outra';

/** Expressões de IA e adjetivos vazios que o redator não pode usar. */
export const EXPRESSOES_PROIBIDAS = [
  'mergulhe', 'jornada', 'desvendar', 'em resumo', 'em conclusão', 'em conclusao',
  'crucial', 'imperativo', 'notável', 'notavel', 'tesouro', 'ademais',
  'primeiramente', 'é importante ressaltar', 'no cenário atual', 'no cenario atual',
  'tapeçaria', 'alavancar', 'multifacetado', 'sinergia', 'catalisador',
  'nesse contexto', 'de fundamental importância', 'contribuindo assim para',
  'no âmbito', 'em consonância', 'consoante', 'outrossim', 'haja vista',
  'destarte', 'mormente', 'denota-se', 'ressalta-se', 'evidencia-se', 'depreende-se',
  'revolucionário', 'revolucionária', 'maravilhoso', 'maravilhosa', 'incrível', 'incrivel',
  'espetacular', 'mágico', 'mágica', 'extraordinário', 'extraordinária', 'fantástico',
  'impressionante', 'excepcional', 'brilhante', 'disruptivo', 'disruptiva',
  'vale ressaltar', 'vale destacar', 'ao longo da história', 'na era contemporânea',
];

const normalizar = (t: string) =>
  t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

export function semTags(html: string): string {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Expressões proibidas encontradas no texto (palavra inteira). */
export function detectarProibidas(texto: string): string[] {
  const t = ` ${semTags(texto).toLowerCase()} `;
  return EXPRESSOES_PROIBIDAS.filter(e => {
    const escapado = e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?<!\\p{L})${escapado}(?!\\p{L})`, 'u').test(t);
  });
}

/** Remove a cerca de código (```html) que a IA às vezes devolve. */
export function limparHtml(saida: string): string {
  return (saida || '').trim().replace(/^```(?:html)?\s*/i, '').replace(/\s*```$/, '').trim();
}

export function tipoDaSecao(titulo: string): TipoSecao {
  const t = normalizar(titulo);
  if (/resumo|apresentacao/.test(t)) return 'resumo';
  if (/justificativ|relevancia|contextualizacao|problema/.test(t)) return 'justificativa';
  if (/objetivo|meta/.test(t)) return 'objetivos';
  if (/metodolog|plano de trabalho|estrategia de execucao|atividades/.test(t) && !/cronograma/.test(t)) return 'metodologia';
  if (/cronograma/.test(t)) return 'cronograma';
  if (/orcamento|planilha|custos|financeir/.test(t)) return 'orcamento';
  if (/resultado|impacto|indicador|produto/.test(t)) return 'resultados';
  if (/equipe|ficha tecnica|curriculo/.test(t)) return 'equipe';
  if (/acessibilidade|democratizacao/.test(t)) return 'acessibilidade';
  return 'outra';
}

/** Ordem de geração: 1 = base, 2 = intermediárias, 3 = sínteses (dependem das demais). */
export function ondaDaSecao(tipo: TipoSecao): 1 | 2 | 3 {
  if (tipo === 'objetivos' || tipo === 'justificativa') return 1;
  if (tipo === 'resultados' || tipo === 'resumo') return 3;
  return 2;
}

export function guiaDaSecao(tipo: TipoSecao, pesquisa: boolean): string {
  switch (tipo) {
    case 'justificativa':
      return pesquisa
        ? 'Estruture em 4 a 5 parágrafos: (1) problema de pesquisa e sua relevância; (2) estado da arte e lacuna; (3) hipótese ou contribuição esperada; (4) aderência ao objetivo do edital; (5) impacto científico, tecnológico e social. Cite dados e referências somente se constarem nas fontes fornecidas.'
        : 'Estruture em 4 a 5 parágrafos: (1) diagnóstico do problema e do território; (2) lacuna das soluções atuais; (3) a solução proposta; (4) capacidade da instituição proponente; (5) impacto e sustentabilidade após o recurso. Use dados somente se constarem nas fontes fornecidas.';
    case 'objetivos':
      return 'Escreva um parágrafo com o objetivo geral e, em seguida, uma lista <ul> com os objetivos específicos, cada um começando por verbo no infinitivo e com meta mensurável (SMART) apenas quando houver dado no contexto.';
    case 'metodologia':
      return pesquisa
        ? 'Estruture em fases: método e materiais, procedimentos e atividades por etapa, análise dos dados, gestão de riscos e forma de avaliação dos resultados.'
        : 'Estruture em fases: preparação (mobilização, contratações), execução das atividades principais e encerramento (avaliação e prestação de contas).';
    case 'cronograma':
      return 'Apresente obrigatoriamente em tabela HTML (<table>, <tr>, <th>, <td>) com as colunas "Etapa / Fase", "Período (Meses)", "Atividades Previstas" e "Marcos de Entrega". Respeite o prazo máximo do edital.';
    case 'orcamento':
      return 'Apresente em tabela HTML com item, descrição e valor, somente com itens financiáveis pelo edital. Não invente valores: onde o usuário não informou, escreva [PREENCHER: valor]. Respeite o valor máximo do edital.';
    case 'resultados':
      return 'Liste produtos, resultados e indicadores de verificação ligados aos objetivos. Use números somente se constarem nas métricas ou no rascunho do usuário.';
    case 'resumo':
      return 'Escreva 1 a 2 parágrafos que sintetizem problema, solução, público, resultado esperado e relação com o objetivo do edital, coerentes com as demais seções.';
    case 'equipe':
      return 'Descreva as funções necessárias. Use somente nomes e qualificações informados pelo usuário; onde faltar, escreva [PREENCHER: nome e qualificação].';
    case 'acessibilidade':
      return 'Descreva medidas concretas de acessibilidade previstas nas atividades, conforme as exigências do edital, sem prometer o que o projeto não prevê.';
    default:
      return 'Desenvolva a seção de acordo com o que o edital pede para ela, de forma objetiva e coerente com as demais seções.';
  }
}

export { ehEditalDePesquisa };

/**
 * Números do texto que não aparecem no contexto (edital, proposta, métricas, rascunho).
 * Inteiros até 12 (meses, etapas) são ignorados.
 */
export function numerosNaoSuportados(texto: string, contexto: string): string[] {
  const pegar = (t: string) => t.match(/\d[\d.,]*\d|\d/g) || [];
  const chave = (n: string) => n.replace(/[.,]/g, '');
  const conhecidos = new Set(pegar(contexto).map(chave));
  const achados = new Set<string>();
  for (const n of pegar(semTags(texto))) {
    if (/^\d{1,2}$/.test(n) && Number(n) <= 12) continue;
    if (!conhecidos.has(chave(n))) achados.add(n);
  }
  return Array.from(achados);
}
