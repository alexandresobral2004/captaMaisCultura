const globalForProjetos = globalThis as unknown as {
  projetosCientificos?: Map<string, any>;
};

if (!globalForProjetos.projetosCientificos) {
  globalForProjetos.projetosCientificos = new Map();
}

const map = globalForProjetos.projetosCientificos;

if (!map.has('1')) {
  map.set('1', {
    id: '1',
    titulo: 'Desenvolvimento de Plataforma IoT para Monitoramento de Poluição Urbana',
    areaTematica: 'Engenharias',
    nivel: 'pesquisador',
    status: 'rascunho',
    resumoExecutivo: 'Este projeto propõe o desenvolvimento de uma plataforma de Internet das Coisas (IoT) voltada para o monitoramento em tempo real dos índices de poluição do ar em centros urbanos.',
    justificativa: 'A poluição atmosférica é um dos maiores desafios de saúde pública enfrentados por grandes metrópoles contemporâneas, demandando ferramentas de medição capilares e precisas.',
    objetivos: JSON.stringify({
      geral: 'Desenvolver e validar uma arquitetura de monitoramento de qualidade do ar integrada a redes urbanas inteligentes utilizando sensores de baixo custo.',
      especificos: [
        { cod: 'OE1', descricao: 'Projetar protótipo de hardware de sensoriamento contendo sensores de gases nocivos.', indicador: 'Protótipo homologado', meta: '1 protótipo operacional' },
        { cod: 'OE2', descricao: 'Desenvolver painel web para visualização pública e análise de dados históricos.', indicador: 'Plataforma web no ar', meta: '1 dashboard acessível' }
      ]
    }),
    metodologia: 'A metodologia consistirá em três etapas principais: especificação e integração do hardware sensor, calibração contra equipamentos de referência da agência ambiental local, e implantação piloto de cinco unidades de sensoriamento nas proximidades de vias de grande tráfego.',
    resultadosEsperados: 'Espera-se obter uma base de dados georreferenciada detalhada com amostragem minuto a minuto, possibilitando aos gestores públicos a tomada de decisões de trânsito baseadas em evidências de qualidade do ar.',
    referencias: '[1] ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS. NBR 10151: Acústica - Medição e avaliação de níveis de pressão sonora. Rio de Janeiro, 2019.\n[2] TAVILY SEARCH INDEX. Real-time Urban Pollution Monitoring Systems and Smart City Frameworks. Disponível em: <https://tavily.com>. Acesso em: 7 jun. 2026.',
    titulosPersonalizados: '{}',
    pesquisadoresProponentes: JSON.stringify([
      { nome: 'Dr. Carlos Silva', cpf: '123.456.789-00', titulacao: 'Doutorado', vinculo: 'Universidade Federal', funcao: 'Coordenador', lattes: 'http://lattes.cnpq.br/12345678' }
    ]),
    secoesDinamicas: JSON.stringify([
      { id: 'resumo', chave: 'resumo', titulo: 'Resumo Executivo', conteudo: '<p>Este projeto propõe o desenvolvimento de uma plataforma de Internet das Coisas (IoT) voltada para o monitoramento em tempo real dos índices de poluição do ar em centros urbanos.</p>', completa: true, editavel: true, ordem: 0 },
      { id: 'justificativa', chave: 'justificativa', titulo: 'Justificativa', conteudo: '<p>A poluição atmosférica é um dos maiores desafios de saúde pública enfrentados por grandes metrópoles contemporâneas, demandando ferramentas de medição capilares e precisas.</p>', completa: true, editavel: true, ordem: 1 },
      { id: 'objetivos', chave: 'objetivos', titulo: 'Objetivos', conteudo: '', completa: true, editavel: true, ordem: 2 },
      { id: 'metodologia', chave: 'metodologia', titulo: 'Metodologia', conteudo: '<p>A metodologia consistirá em três etapas principais: especificação e integração do hardware sensor, calibração contra equipamentos de referência da agência ambiental local, e implantação piloto de cinco unidades de sensoriamento nas proximidades de vias de grande tráfego.</p>', completa: true, editavel: true, ordem: 3 },
      { id: 'resultados', chave: 'resultados', titulo: 'Resultados Esperados', conteudo: '<p>Espera-se obter uma base de dados georreferenciada detalhada com amostragem minuto a minuto, possibilitando aos gestores públicos a tomada de decisões de trânsito baseadas em evidências de qualidade do ar.</p>', completa: true, editavel: true, ordem: 4 },
      { id: 'referencias', chave: 'referencias', titulo: 'Referências Bibliográficas (ABNT)', conteudo: '<p>[1] ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS. NBR 10151: Acústica - Medição e avaliação de níveis de pressão sonora. Rio de Janeiro, 2019.<br>[2] TAVILY SEARCH INDEX. Real-time Urban Pollution Monitoring Systems and Smart City Frameworks. Disponível em: &lt;https://tavily.com&gt;. Acesso em: 7 jun. 2026.</p>', completa: true, editavel: true, ordem: 5 }
    ]),
    orcamento: null,
    cronograma: [],
    equipe: [],
    dataCriacao: new Date().toISOString(),
    dataAtualizacao: new Date().toISOString(),
    versao: 1
  });
}

export const projetos = globalForProjetos.projetosCientificos;


