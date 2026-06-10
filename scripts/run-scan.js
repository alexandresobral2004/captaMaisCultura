const http = require('http');
const { URL } = require('url');

const API_URL = process.argv[2] || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const SCAN_TOKEN = process.argv[3] || process.env.SCAN_TOKEN || 'capta-mais-scan-token-secret-2026';

const editaisResults = {};
let streamReq;
let jobTriggered = false;

console.log(`🚀 Conectando ao stream de logs em ${API_URL}...`);

// 1. Conectar ao EventStream de logs com history=false
const streamUrl = new URL('/api/v1/scraper/logs/stream?history=false', API_URL);
streamReq = http.request({
  hostname: streamUrl.hostname,
  port: streamUrl.port || (streamUrl.protocol === 'https:' ? 443 : 80),
  path: streamUrl.pathname + streamUrl.search,
  method: 'GET',
  headers: {
    'X-Scan-Token': SCAN_TOKEN
  }
}, (res) => {
  if (res.statusCode !== 200) {
    console.error(`❌ Falha ao conectar ao stream de logs. Status HTTP: ${res.statusCode}`);
    process.exit(1);
  }

  res.setEncoding('utf8');
  let buffer = '';

  // Disparar o job no backend agora que o stream está conectado e ouvindo
  triggerJob();
  
  res.on('data', (chunk) => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop(); // Mantém linha parcial
    
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      try {
        const jsonStr = line.slice(5).trim();
        const event = JSON.parse(jsonStr);
        
        const phase = event.phase || 'busca';
        const message = event.message || '';
        const editalTitulo = event.editalTitulo || '';
        const detail = event.detail || '';
        
        // Imprimir no console
        if (editalTitulo) {
          console.log(`   [${phase.toUpperCase()}] ${message} | ${editalTitulo} ${detail ? `(${detail})` : ''}`);
        } else {
          console.log(`   [${phase.toUpperCase()}] ${message} ${detail ? `(${detail})` : ''}`);
        }
        
        // Rastrear resultado para o relatório
        if (phase === 'resultado' && editalTitulo) {
          const status = message.includes('SALVO') ? 'ACEITO' : 'REJEITADO';
          editaisResults[editalTitulo] = { status, detail };
        }

        // Se detectou finalização do job no log, fechar e imprimir relatório
        if (message.includes('Varredura concluída com sucesso')) {
          console.log('\n✅ Fim da varredura detectado nos logs.');
          streamReq.destroy();
          imprimirRelatorio(true);
        } else if (message.includes('ERRO FATAL NO PIPELINE')) {
          console.log('\n❌ Erro fatal detectado nos logs.');
          streamReq.destroy();
          imprimirRelatorio(false);
        }
      } catch (err) {
        // Ignorar erros de parser JSON parciais
      }
    }
  });
});

streamReq.on('error', (e) => {
  console.error(`⚠️ Erro na conexão de stream: ${e.message}`);
  if (!jobTriggered) {
    process.exit(1);
  }
});

streamReq.end();

function triggerJob() {
  jobTriggered = true;
  console.log('📡 Stream de logs conectado. Disparando o Job no backend...');
  
  // 2. Disparar o Job no backend (POST)
  const jobUrl = new URL('/api/jobs/run-weekly-scan', API_URL);
  const postData = JSON.stringify({ token: SCAN_TOKEN });
  const postReq = http.request({
    hostname: jobUrl.hostname,
    port: jobUrl.port || (jobUrl.protocol === 'https:' ? 443 : 80),
    path: jobUrl.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'X-Scan-Token': SCAN_TOKEN
    }
  }, (res) => {
    let body = '';
    res.setEncoding('utf8');
    res.on('data', (chunk) => { body += chunk; });
    res.on('end', () => {
      // Se o POST falhou (ex: 409 Conflito ou 401), parar o stream e reportar erro
      if (res.statusCode !== 200 && res.statusCode !== 202) {
        streamReq.destroy();
        console.error(`\n❌ Falha ao iniciar JobRunner. Status HTTP: ${res.statusCode}`);
        try {
          console.log(JSON.stringify(JSON.parse(body), null, 2));
        } catch {
          console.log(body);
        }
        process.exit(1);
      } else {
        console.log('📡 JobRunner iniciado com sucesso no backend (executando em background)...');
      }
    });
  });

  postReq.on('error', (e) => {
    console.error(`❌ Erro ao disparar job: ${e.message}`);
    streamReq.destroy();
    process.exit(1);
  });

  postReq.write(postData);
  postReq.end();
}

function imprimirRelatorio(success) {
  const accepted = [];
  const rejected = [];
  for (const [title, info] of Object.entries(editaisResults)) {
    if (info.status === 'ACEITO') {
      accepted.push(`   - ${title} (Motivo: ${info.detail})`);
    } else {
      rejected.push(`   - ${title} (Motivo: ${info.detail})`);
    }
  }
  
  console.log('\n==========================================================================');
  console.log('📋 RELATÓRIO DE VARREDURA DE EDITAIS');
  console.log('==========================================================================');
  
  console.log('\n🟢 EDITAIS ACEITOS (SALVOS):');
  if (accepted.length > 0) {
    console.log(accepted.join('\n'));
  } else {
    console.log('   Nenhum edital foi aceito nesta busca.');
  }
  
  console.log('\n🔴 EDITAIS REJEITADOS / NEGADOS:');
  if (rejected.length > 0) {
    console.log(rejected.join('\n'));
  } else {
    console.log('   Nenhum edital foi rejeitado nesta busca.');
  }
  console.log('==========================================================================\n');
  
  if (success) {
    console.log('✅ Busca concluída com sucesso!');
    process.exit(0);
  } else {
    console.error('❌ Busca terminada com erro no pipeline.');
    process.exit(1);
  }
}
