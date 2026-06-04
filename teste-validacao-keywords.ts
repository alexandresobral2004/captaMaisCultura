/**
 * SCRIPT DE TESTE - VALIDAÇÃO COM KEYWORDS
 * 
 * Testa o sistema de filtragem e validação de editais
 * com diferentes cenários de conteúdo
 */

import { validarConteudoComKeywords, resumoValidacaoKeywords } from './lib/scraper/keyword-validator';
import { extrairDadosEditais, formatarDadosExtraidos } from './lib/scraper/edital-extractor';

// Cenários de teste
const CENARIOS_TESTE = {
  // ✅ CENÁRIO 1: Edital válido - muitas palavras-chave
  editalValido: `
    EDITAL DE FOMENTO À PESQUISA - CNPQ 2024
    
    A Fundação Nacional de Desenvolvimento Científico e Tecnológico convida a comunidade 
    científica para submissão de projetos de pesquisa e inovação tecnológica.
    
    OBJETIVO:
    Este edital visa apoiar projetos de pesquisa acadêmica em instituições de ensino superior 
    reconhecidas, visando o desenvolvimento tecnológico e a inovação.
    
    CRONOGRAMA:
    - Data de publicação: 29/05/2026
    - Prazo de inscrição: 31/07/2026
    - Data de encerramento: 31/07/2026
    - Resultado preliminar: 15/08/2026
    - Resultado final: 30/08/2026
    
    FINANCIAMENTO:
    O valor total de financiamento é de R$ 5.000.000,00 distribuído em bolsas de pesquisa 
    e auxílios de custeio e capital para grupos de pesquisa.
    
    ELEGIBILIDADE:
    Poderão participar deste edital:
    - Pesquisadores com vínculo institucional ativo
    - Coordenadores de grupos de pesquisa registrados no CNPq
    - Instituições de ensino com cursos de pós-graduação
    - Instituições de pesquisa sem fins lucrativos
    
    REQUISITOS OBRIGATÓRIOS:
    1. Currículo Lattes atualizado
    2. Comprovação de vínculo institucional
    3. Plano de trabalho detalhado
    4. Orçamento justificado
    5. Documentação fiscal da instituição
    
    CRITÉRIOS DE AVALIAÇÃO:
    - Mérito científico (peso 40%)
    - Impacto científico (peso 30%)
    - Adequação orçamentária (peso 20%)
    - Viabilidade executiva (peso 10%)
    
    DOCUMENTAÇÃO NECESSÁRIA:
    - Formulário de inscrição preenchido
    - Currículo Lattes em PDF
    - Plano de trabalho em PDF
    - Termo de outorga assinado
    - Documento de filiação institucional
    - Comprovante de capacidade técnica
    
    SUBMISSÃO:
    As propostas deverão ser enviadas exclusivamente através do sistema de submissão oficial.
    O formulário de inscrição está disponível na plataforma.
    
    CLASSIFICAÇÃO:
    Os projetos serão classificados pela comissão avaliadora conforme os critérios acima.
    Será realizada análise documental de todas as submissões.
    
    HOMOLOGAÇÃO:
    O resultado será publicado no site oficial. Haverá prazo para recurso administrativo 
    de 10 dias úteis.
  `,

  // ❌ CENÁRIO 2: Texto genérico - poucas palavras-chave
  textoGenerico: `
    Aviso Público - Comunicado Importante
    
    Comunicamos a todos os interessados que há atualizações importantes.
    O processo segue seus trâmites normais.
    
    Maiores informações podem ser obtidas no endereço abaixo.
    Atenciosamente,
    Administração
  `,

  // ✅ CENÁRIO 3: Edital de pesquisa acadêmica
  editalPesquisaAcademica: `
    EDITAL PARA BOLSA DE INICIAÇÃO CIENTÍFICA 2024
    
    A Fundação de Amparo à Pesquisa abre chamada pública para seleção de bolsistas 
    de iniciação científica.
    
    PÚBLICO-ALVO:
    Estudantes regularmente matriculados em cursos de graduação
    
    ÁREA TEMÁTICA:
    Pesquisa em desenvolvimento tecnológico e inovação
    
    PROCESSO SELETIVO:
    1. Apresentação da proposta de pesquisa
    2. Análise por especialista
    3. Aprovação da comissão
    4. Assinatura do termo de compromisso
    
    BENEFÍCIOS:
    - Bolsa mensal de R$ 500,00
    - Auxílio para material de pesquisa
    - Acesso a laboratórios
    
    INSCRIÇÃO:
    Formulário disponível no portal institucional
    Data limite: 30/06/2026
    
    RESULTADO:
    Divulgação em 15/07/2026
  `,

  // ❌ CENÁRIO 4: Documento comercial (não-edital)
  textoComercial: `
    PROPOSTA COMERCIAL
    
    Prezado Cliente,
    
    Segue abaixo nossa proposta para fornecimento de serviços.
    
    DESCRIÇÃO DOS SERVIÇOS:
    Limpeza e manutenção predial
    
    VALOR:
    R$ 10.000,00
    
    CONDIÇÕES:
    Pagamento em 30 dias
    
    Atenciosamente,
    Empresa ABC
  `,

  // ✅ CENÁRIO 5: Edital de evento científico
  editalEvento: `
    CHAMADA PÚBLICA PARA EVENTO CIENTÍFICO
    
    Congresso Internacional de Tecnologia 2026
    
    Convite para apresentação de trabalhos e artigos científicos
    
    OBJETIVO DO EVENTO:
    Promover discussão sobre inovação tecnológica e pesquisa aplicada
    
    SUBMISSÃO DE TRABALHOS:
    - Prazo de inscrição: 30/06/2026
    - Formato: artigos em PDF
    - Áreas temáticas: tecnologia, pesquisa, desenvolvimento
    
    PROCESSO DE SELEÇÃO:
    - Análise documental
    - Avaliação por comitê científico
    - Comunicação de resultados em 15/07/2026
    
    APRESENTAÇÃO:
    Apresentação oral no congresso, com publicação nos anais
    
    PÚBLICO-ALVO:
    Pesquisadores, alunos de pós-graduação, profissionais da área
  `,

  // ❌ CENÁRIO 6: Muito curto - insuficiente para validação
  textoMuitoCurto: `
    Edital
    Pesquisa
    Inscrição
  `,

  // ✅ CENÁRIO 7: Edital com termos de financiamento
  editalFinanciamento: `
    CHAMADA PÚBLICA DE FOMENTO À INOVAÇÃO
    
    Fundação de Inovação Tecnológica abre seleção de projetos
    
    ELEGIBILIDADE:
    Empresas, startups e instituições de pesquisa
    
    FINANCIAMENTO DISPONÍVEL:
    - Valor máximo por projeto: R$ 500.000
    - Valor mínimo: R$ 50.000
    - Forma: Subvenção econômica e repasse de recursos
    
    CRONOGRAMA OFICIAL:
    Inscrição: 01/06 a 31/07/2026
    Homologação: 15/08/2026
    Divulgação: 30/08/2026
    Contrapartida: Solicitado conforme edital
    
    REQUISITOS DE ELEGIBILIDADE:
    - Registro na Junta Comercial
    - Documentação fiscal em dia
    - Plano de trabalho estruturado
    
    CRITÉRIOS DE SELEÇÃO:
    Julgamento por comissão avaliadora conforme barema
    
    DOCUMENTOS OBRIGATÓRIOS:
    - Formulário de submissão
    - Proposta técnica
    - Orçamento detalhado
    - Termo de outorga
  `
};

/**
 * Testa cada cenário e exibe resultados
 */
async function testarCenarios() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 TESTES DE VALIDAÇÃO COM KEYWORDS');
  console.log('='.repeat(80) + '\n');

  let aprovados = 0;
  let rejeitados = 0;

  for (const [nome, texto] of Object.entries(CENARIOS_TESTE)) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`📋 CENÁRIO: ${nome}`);
    console.log(`${'─'.repeat(80)}\n`);

    try {
      // Validar
      const resultado = await validarConteudoComKeywords(texto);

      // Exibir resultado formatado
      console.log(resumoValidacaoKeywords(resultado));

      // Estatísticas
      if (resultado.isEdital) {
        aprovados++;
        console.log('✅ RESULTADO: EDITAL VÁLIDO\n');

        // Testar extração se validado
        try {
          const dados = await extrairDadosEditais(texto, resultado, `Edital ${nome}`);
          console.log('📊 DADOS EXTRAÍDOS:');
          console.log(formatarDadosExtraidos(dados));
        } catch (erro) {
          console.log(`⚠️ Erro ao extrair dados: ${(erro as Error).message}\n`);
        }
      } else {
        rejeitados++;
        console.log('❌ RESULTADO: REJEITADO\n');
      }
    } catch (erro) {
      console.error(`❌ ERRO ao testar cenário: ${(erro as Error).message}`);
      rejeitados++;
    }
  }

  // RESUMO FINAL
  console.log('\n' + '='.repeat(80));
  console.log('📊 RESUMO FINAL DOS TESTES');
  console.log('='.repeat(80) + '\n');
  console.log(`Total de cenários testados: ${Object.keys(CENARIOS_TESTE).length}`);
  console.log(`✅ Aprovados: ${aprovados}`);
  console.log(`❌ Rejeitados: ${rejeitados}`);
  console.log(`Taxa de aprovação: ${Math.round((aprovados / Object.keys(CENARIOS_TESTE).length) * 100)}%`);
  console.log('\n' + '='.repeat(80) + '\n');

  // ANÁLISE
  console.log('📈 ANÁLISE:');
  console.log('');
  console.log('Cenários que DEVEM SER APROVADOS:');
  console.log('  ✓ editalValido - Edital completo com muitas palavras-chave');
  console.log('  ✓ editalPesquisaAcademica - Bolsa de IC com contexto claro');
  console.log('  ✓ editalEvento - Evento científico com chamada clara');
  console.log('  ✓ editalFinanciamento - Fomento com termos financeiros');
  console.log('');
  console.log('Cenários que DEVEM SER REJEITADOS:');
  console.log('  ✗ textoGenerico - Sem palavras-chave suficientes');
  console.log('  ✗ textoComercial - Proposta comercial, não-edital');
  console.log('  ✗ textoMuitoCurto - Muito curto, insuficiente');
  console.log('');
}

// Executar testes
testarCenarios().catch(console.error);
