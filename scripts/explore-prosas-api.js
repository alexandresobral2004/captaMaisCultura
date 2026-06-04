#!/usr/bin/env node
/**
 * Script de diagnóstico para explorar a API V2 da Prosas
 * Objetivo: entender que dados retornam e como achar o PDF do edital
 */
const axios = require('axios');

async function main() {
  console.log('=== EXPLORANDO A API PROSAS V2 ===\n');

  // 1. Obter token OAuth2
  console.log('1. Obtendo token OAuth2...');
  const tokenRes = await axios.post('https://prosas.com.br/auth/oauth2/token', {
    grant_type: 'client_credentials',
    client_id: 'lsf6jeu7-Wk04P2iSYMdcMhPZUNZqabK8CG6mAfRQ6M',
    scope: 'public'
  });
  const token = tokenRes.data.access_token;
  console.log(`   Token obtido: ${token.substring(0, 20)}...`);

  // 2. Buscar 2 editais com includes para ver todos os dados
  console.log('\n2. Buscando 2 editais com include=area_interesses,incentivador...');
  const listRes = await axios.get('https://prosas.com.br/selecao/api/v2/third_party/oportunidades/inscricoes_abertas', {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
    params: { 'include': 'area_interesses,incentivador', 'page[page]': 1, 'page[size]': 2 }
  });

  const items = listRes.data.data;
  console.log(`   ${items.length} itens retornados`);
  
  // Mostrar a estrutura COMPLETA de um edital
  if (items.length > 0) {
    console.log('\n3. ESTRUTURA COMPLETA DO PRIMEIRO EDITAL:');
    console.log(JSON.stringify(items[0], null, 2));
    
    console.log('\n4. TODAS AS CHAVES DE attributes:');
    console.log(Object.keys(items[0].attributes));

    // Checar se há included
    if (listRes.data.included) {
      console.log('\n5. INCLUDED (relationships):');
      console.log(JSON.stringify(listRes.data.included.slice(0, 3), null, 2));
    }
    
    // Checar se há links ou meta no topo
    if (listRes.data.links) {
      console.log('\n6. LINKS no top-level:');
      console.log(JSON.stringify(listRes.data.links, null, 2));
    }
    if (listRes.data.meta) {
      console.log('\n7. META no top-level:');
      console.log(JSON.stringify(listRes.data.meta, null, 2));
    }
  }

  // 3. Tentar endpoint de detalhe de um edital específico
  const editalId = items[0]?.id;
  if (editalId) {
    console.log(`\n8. Tentando acessar detalhe do edital ${editalId}...`);
    
    // Tentar várias rotas possíveis
    const rotas = [
      `https://prosas.com.br/selecao/api/v2/third_party/oportunidades/${editalId}`,
      `https://prosas.com.br/selecao/api/v2/oportunidades/${editalId}`,
      `https://prosas.com.br/api/v2/oportunidades/${editalId}`,
    ];
    
    for (const rota of rotas) {
      try {
        const detailRes = await axios.get(rota, {
          headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
          timeout: 5000
        });
        console.log(`   ✅ ROTA FUNCIONOU: ${rota}`);
        console.log('   RESPOSTA:', JSON.stringify(detailRes.data, null, 2).substring(0, 2000));
      } catch (e) {
        console.log(`   ❌ ${rota} -> ${e.response?.status || e.message}`);
      }
    }
  }
  
  // 4. Tentar acessar a página do edital e ver a estrutura HTML
  if (editalId) {
    console.log(`\n9. Acessando página web do edital ${editalId}...`);
    const urls = [
      `https://prosas.com.br/editais/${editalId}`,
      `https://prosas.com.br/oportunidades/${editalId}`,
      `https://prosas.com.br/editais/edital?edital_id=${editalId}`,
      `https://produtos.prosas.com.br/editais/edital?edital_id=${editalId}`,
    ];
    
    for (const url of urls) {
      try {
        const r = await axios.get(url, { timeout: 10000, maxRedirects: 5 });
        console.log(`   ✅ ${url} -> status ${r.status}, tamanho: ${r.data.length} chars`);
        
        // Buscar links de PDF na página
        const pdfMatches = r.data.match(/href="[^"]*\.pdf[^"]*"/gi) || [];
        console.log(`   Links PDF encontrados: ${pdfMatches.length}`);
        pdfMatches.forEach(m => console.log(`      ${m}`));
        
        // Buscar download links
        const downloadMatches = r.data.match(/href="[^"]*download[^"]*"/gi) || [];
        console.log(`   Links download encontrados: ${downloadMatches.length}`);
        downloadMatches.forEach(m => console.log(`      ${m}`));

        // Buscar referências a "regulamento" ou "edital" nos links
        const editalLinks = r.data.match(/href="[^"]*(?:regulamento|edital|documento|anexo)[^"]*"/gi) || [];
        console.log(`   Links regulamento/edital/documento/anexo: ${editalLinks.length}`);
        editalLinks.forEach(m => console.log(`      ${m}`));
        
      } catch (e) {
        console.log(`   ❌ ${url} -> ${e.response?.status || e.message}`);
      }
    }
  }
}

main().catch(err => {
  console.error('ERRO:', err.message);
  process.exit(1);
});
