/**
 * Script de teste para o pipeline de Prosas
 * Execute com: node scripts/teste-prosas.js
 */

const axios = require('axios');

async function testarProsas() {
  console.log('🧪 Iniciando teste do pipeline Prosas...\n');

  try {
    // Verificar variáveis de ambiente
    const email = process.env.PROSAS_EMAIL;
    const password = process.env.PROSAS_PASSWORD;

    if (!email || !password) {
      console.error('❌ Erro: Credenciais Prosas não encontradas em .env.local');
      console.error('   Adicione: PROSAS_EMAIL e PROSAS_PASSWORD');
      process.exit(1);
    }

    console.log('✅ Credenciais Prosas detectadas\n');

    // Solicitar token
    console.log('📡 Solicitando token de acesso...');
    const tokenRes = await axios.post('https://prosas.com.br/auth/oauth2/token', {
      grant_type: 'client_credentials',
      client_id: 'lsf6jeu7-Wk04P2iSYMdcMhPZUNZqabK8CG6mAfRQ6M',
      scope: 'public'
    });

    const token = tokenRes.data.access_token;
    console.log('✅ Token obtido com sucesso\n');

    // Listar editais
    console.log('📋 Buscando editais abertos...');
    const listRes = await axios.get('https://prosas.com.br/selecao/api/v2/third_party/oportunidades/inscricoes_abertas', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      params: {
        'include': 'area_interesses,incentivador',
        'page[page]': 1,
        'page[size]': 5  // Apenas 5 para teste rápido
      }
    });

    if (!listRes.data || !listRes.data.data) {
      console.error('❌ API retornou resposta inesperada');
      console.error(JSON.stringify(listRes.data, null, 2));
      process.exit(1);
    }

    const editais = listRes.data.data;
    console.log(`✅ ${editais.length} editais encontrados\n`);

    // Buscar detalhe do primeiro edital
    if (editais.length > 0) {
      const primeiroEdital = editais[0];
      console.log(`📄 Buscando detalhe do edital ${primeiroEdital.id}...`);

      const detalheRes = await axios.get(
        `https://prosas.com.br/selecao/api/v2/third_party/oportunidades/${primeiroEdital.id}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          },
          params: {
            'include': 'arquivos,sites'
          }
        }
      );

      const detalhe = detalheRes.data.data;
      const proc = detalhe.attributes;

      console.log('\n📊 Dados do Edital:');
      console.log(`   Nome: ${proc.nome}`);
      console.log(`   Órgão: ${proc.nome_empresa || 'N/A'}`);
      console.log(`   Valor Limite: ${proc.valor_limite ? `R$ ${proc.valor_limite.toLocaleString('pt-BR')}` : 'N/A'}`);
      console.log(`   Data Limite: ${proc.data_limite_inscricao_sem_rascunho || proc.encerramento_das_inscricoes || 'N/A'}`);
      console.log(`   Descrição: ${proc.descricao ? `${proc.descricao.substring(0, 100)}...` : 'N/A'}`);
      console.log(`   Link: ${proc.link || 'N/A'}`);

      // Verificar arquivos
      if (detalheRes.data.included) {
        const arquivos = detalheRes.data.included.filter((inc) => inc.type === 'arquivo');
        console.log(`\n📎 Arquivos Anexos: ${arquivos.length}`);
        for (const arquivo of arquivos) {
          const fileAttrs = arquivo.attributes;
          console.log(`   - ${fileAttrs.nome || 'Sem nome'} (${fileAttrs.url ? '✅ URL disponível' : '❌ Sem URL'})`);
        }
      }

      console.log('\n✅ Teste concluído com sucesso!');
    }

  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Dados:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

testarProsas();
