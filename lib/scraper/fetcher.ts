import axios from 'axios';
import * as cheerio from 'cheerio';
import { getPortais, removerPortal, PortalConfig } from './config';
import { Edital, saveEdital, parseDateString } from '../db/editais-store';
import { buscarEditaisProsas } from './prosas-scraper';
import { buscarEditaisCapta } from './capta-scraper';
import { buscarEditaisFinep, buscarEditaisCNPq, buscarEditaisCapes, buscarEditaisMinisterioCiencia } from './portais-finep-cnpq-capes';
import { validarComOpenAI, validarBlacklist, validarWhitelistTI } from './filtros-ti';

// Helper para converter string de data em formato Date
function extrairData(texto: string): Date | null {
  // Encontra padrões como DD/MM/YYYY ou DD.MM.YYYY ou YYYY-MM-DD
  const regex = /(\d{2})\/(\d{2})\/(\d{4})/;
  const match = texto.match(regex);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const year = parseInt(match[3], 10);
    return new Date(year, month, day, 23, 59, 59);
  }
  return null;
}

// Função utilitária para "dormir" (delay) e garantir um crawling ético.
// O robots.txt de muitos portais pede de 10 a 30s de Crawl-Delay.
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function buscarEditaisPortais(): Promise<Edital[]> {
  const novosEditais: Edital[] = [];
  const agora = new Date();
  const tempoInicio = Date.now();

  // Interface para rastrear dados dos portais
  interface StatusPortal {
    nome: string;
    numero: number;
    sucesso: boolean;
    editaisRetornados: number;
    tempo: number;
    erro?: string;
  }

  const statusPortais: StatusPortal[] = [];

  // 1. Prosas (sessão autenticada)
  console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║    🚀 INICIANDO BUSCA NO PORTAL PROSAS (prosas.com.br) 🚀       ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

  let tempoProsa = Date.now();
  try {
    console.log('  📥 [1/6] Consultando Portal Prosas...');
    const editaisProsas = await buscarEditaisProsas();
    const tempoProasDecorrido = ((Date.now() - tempoProsa) / 1000).toFixed(2);
    
    for (const ed of editaisProsas) {
      const salvo = await saveEdital(ed);
      if (salvo.deletedAt) {
        console.log(`  ⏭️ [PROSAS] Edital ${ed.id} já está excluído no banco de dados. Ignorando no download.`);
        continue;
      }
      novosEditais.push(salvo);
    }
    
    statusPortais.push({
      nome: 'Prosas',
      numero: 1,
      sucesso: true,
      editaisRetornados: editaisProsas.length,
      tempo: parseFloat(tempoProasDecorrido)
    });
    
    console.log(`      ✅ SUCESSO | ${editaisProsas.length} editais retornados | ${tempoProasDecorrido}s\n`);
  } catch (err: any) {
    const tempoProasDecorrido = ((Date.now() - tempoProsa) / 1000).toFixed(2);
    statusPortais.push({
      nome: 'Prosas',
      numero: 1,
      sucesso: false,
      editaisRetornados: 0,
      tempo: parseFloat(tempoProasDecorrido),
      erro: err.message
    });
    console.warn(`      ❌ ERRO | ${err.message} | ${tempoProasDecorrido}s\n`);
  }

  // 2. Capta (capta.org.br)
  console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║    🚀 INICIANDO BUSCA NO PORTAL CAPTA (capta.org.br) 🚀       ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

  let tempoCapta = Date.now();
  try {
    console.log('  📥 [2/6] Consultando Portal Capta...');
    const editaisCapta = await buscarEditaisCapta();
    const tempoCaptaDecorrido = ((Date.now() - tempoCapta) / 1000).toFixed(2);

    for (const ed of editaisCapta) {
      const salvo = await saveEdital(ed);
      if (salvo.deletedAt) {
        console.log(`  ⏭️ [CAPTA] Edital ${ed.id} já está excluído no banco de dados. Ignorando no download.`);
        continue;
      }
      novosEditais.push(salvo);
    }

    statusPortais.push({
      nome: 'Capta',
      numero: 2,
      sucesso: true,
      editaisRetornados: editaisCapta.length,
      tempo: parseFloat(tempoCaptaDecorrido)
    });

    console.log(`      ✅ SUCESSO | ${editaisCapta.length} editais retornados | ${tempoCaptaDecorrido}s\n`);
  } catch (err: any) {
    const tempoCaptaDecorrido = ((Date.now() - tempoCapta) / 1000).toFixed(2);
    statusPortais.push({
      nome: 'Capta',
      numero: 2,
      sucesso: false,
      editaisRetornados: 0,
      tempo: parseFloat(tempoCaptaDecorrido),
      erro: err.message
    });
    console.warn(`      ❌ ERRO | ${err.message} | ${tempoCaptaDecorrido}s\n`);
  }

  // 3. FINEP
  console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║    🚀 INICIANDO BUSCA NO PORTAL FINEP 🚀                          ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

  let tempoFinep = Date.now();
  try {
    console.log('  📥 [3/6] Consultando Portal FINEP...');
    const editaisFinep = await buscarEditaisFinep();
    const tempoFinepDecorrido = ((Date.now() - tempoFinep) / 1000).toFixed(2);

    for (const ed of editaisFinep) {
      const salvo = await saveEdital(ed);
      if (salvo.deletedAt) {
        console.log(`  ⏭️ [FINEP] Edital ${ed.id} já está excluído no banco de dados. Ignorando no download.`);
        continue;
      }
      novosEditais.push(salvo);
    }

    statusPortais.push({
      nome: 'FINEP',
      numero: 3,
      sucesso: true,
      editaisRetornados: editaisFinep.length,
      tempo: parseFloat(tempoFinepDecorrido)
    });

    console.log(`      ✅ SUCESSO | ${editaisFinep.length} editais retornados | ${tempoFinepDecorrido}s\n`);
  } catch (err: any) {
    const tempoFinepDecorrido = ((Date.now() - tempoFinep) / 1000).toFixed(2);
    statusPortais.push({
      nome: 'FINEP',
      numero: 3,
      sucesso: false,
      editaisRetornados: 0,
      tempo: parseFloat(tempoFinepDecorrido),
      erro: err.message
    });
    console.warn(`      ❌ ERRO | ${err.message} | ${tempoFinepDecorrido}s\n`);
  }

  // 4. CNPq
  console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║    🚀 INICIANDO BUSCA NO PORTAL CNPQ 🚀                           ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

  let tempoCNPq = Date.now();
  try {
    console.log('  📥 [4/6] Consultando Portal CNPq...');
    const editaisCNPq = await buscarEditaisCNPq();
    const tempoCNPqDecorrido = ((Date.now() - tempoCNPq) / 1000).toFixed(2);

    for (const ed of editaisCNPq) {
      const salvo = await saveEdital(ed);
      if (salvo.deletedAt) {
        console.log(`  ⏭️ [CNPQ] Edital ${ed.id} já está excluído no banco de dados. Ignorando no download.`);
        continue;
      }
      novosEditais.push(salvo);
    }

    statusPortais.push({
      nome: 'CNPq',
      numero: 4,
      sucesso: true,
      editaisRetornados: editaisCNPq.length,
      tempo: parseFloat(tempoCNPqDecorrido)
    });

    console.log(`      ✅ SUCESSO | ${editaisCNPq.length} editais retornados | ${tempoCNPqDecorrido}s\n`);
  } catch (err: any) {
    const tempoCNPqDecorrido = ((Date.now() - tempoCNPq) / 1000).toFixed(2);
    statusPortais.push({
      nome: 'CNPq',
      numero: 4,
      sucesso: false,
      editaisRetornados: 0,
      tempo: parseFloat(tempoCNPqDecorrido),
      erro: err.message
    });
    console.warn(`      ❌ ERRO | ${err.message} | ${tempoCNPqDecorrido}s\n`);
  }

  // 5. CAPES
  console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║    🚀 INICIANDO BUSCA NO PORTAL CAPES 🚀                          ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

  let tempoCapes = Date.now();
  try {
    console.log('  📥 [5/6] Consultando Portal CAPES...');
    const editaisCapes = await buscarEditaisCapes();
    const tempoCapesDecorrido = ((Date.now() - tempoCapes) / 1000).toFixed(2);

    for (const ed of editaisCapes) {
      const salvo = await saveEdital(ed);
      if (salvo.deletedAt) {
        console.log(`  ⏭️ [CAPES] Edital ${ed.id} já está excluído no banco de dados. Ignorando no download.`);
        continue;
      }
      novosEditais.push(salvo);
    }

    statusPortais.push({
      nome: 'CAPES',
      numero: 5,
      sucesso: true,
      editaisRetornados: editaisCapes.length,
      tempo: parseFloat(tempoCapesDecorrido)
    });

    console.log(`      ✅ SUCESSO | ${editaisCapes.length} editais retornados | ${tempoCapesDecorrido}s\n`);
  } catch (err: any) {
    const tempoCapesDecorrido = ((Date.now() - tempoCapes) / 1000).toFixed(2);
    statusPortais.push({
      nome: 'CAPES',
      numero: 5,
      sucesso: false,
      editaisRetornados: 0,
      tempo: parseFloat(tempoCapesDecorrido),
      erro: err.message
    });
    console.warn(`      ❌ ERRO | ${err.message} | ${tempoCapesDecorrido}s\n`);
  }

  // 6. Ministério da Ciência (MCTI)
  console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║    🚀 INICIANDO BUSCA NO MINISTÉRIO DA CIÊNCIA 🚀                 ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

  let tempoMcti = Date.now();
  try {
    console.log('  📥 [6/6] Consultando Portal Ministério da Ciência...');
    const editaisMcti = await buscarEditaisMinisterioCiencia();
    const tempoMctiDecorrido = ((Date.now() - tempoMcti) / 1000).toFixed(2);

    for (const ed of editaisMcti) {
      const salvo = await saveEdital(ed);
      if (salvo.deletedAt) {
        console.log(`  ⏭️ [MIN. CIÊNCIA] Edital ${ed.id} já está excluído no banco de dados. Ignorando no download.`);
        continue;
      }
      novosEditais.push(salvo);
    }

    statusPortais.push({
      nome: 'Min. Ciência',
      numero: 6,
      sucesso: true,
      editaisRetornados: editaisMcti.length,
      tempo: parseFloat(tempoMctiDecorrido)
    });

    console.log(`      ✅ SUCESSO | ${editaisMcti.length} editais retornados | ${tempoMctiDecorrido}s\n`);
  } catch (err: any) {
    const tempoMctiDecorrido = ((Date.now() - tempoMcti) / 1000).toFixed(2);
    statusPortais.push({
      nome: 'Min. Ciência',
      numero: 6,
      sucesso: false,
      editaisRetornados: 0,
      tempo: parseFloat(tempoMctiDecorrido),
      erro: err.message
    });
    console.warn(`      ❌ ERRO | ${err.message} | ${tempoMctiDecorrido}s\n`);
  }

  // ✨ RESUMO FINAL
  const tempoTotal = ((Date.now() - tempoInicio) / 60000).toFixed(2);
  const sucessos = statusPortais.filter(p => p.sucesso).length;
  const totalEditais = statusPortais.reduce((sum, p) => sum + p.editaisRetornados, 0);
  
  console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║                     📊 RESUMO DE CONSULTAS                         ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');
  
  console.log('  Portal         | Status | Editais Retornados | Tempo (s)');
  console.log('  ' + '─'.repeat(61));
  
  for (const portal of statusPortais) {
    const status = portal.sucesso ? '✅ OK   ' : '❌ ERRO ';
    const editais = String(portal.editaisRetornados).padEnd(18);
    const tempo = String(portal.tempo.toFixed(2)).padStart(9);
    console.log(`  ${portal.nome.padEnd(14)} | ${status} | ${editais} | ${tempo}`);
  }
  
  console.log('  ' + '─'.repeat(61));
  console.log(`  TOTAL: ${sucessos}/${statusPortais.length} portais com sucesso | ${totalEditais} editais | ${tempoTotal} min\n`);
  
  // Distribuição por tecnologia
  const distribuicao: { [key: string]: number } = {};
  for (const e of novosEditais) {
    const tech = e.tecnologiaFoco || 'Outro';
    distribuicao[tech] = (distribuicao[tech] || 0) + 1;
  }
  console.log(`   Distribuição por tecnologia:`);
  for (const [tech, count] of Object.entries(distribuicao).sort((a, b) => b[1] - a[1])) {
    console.log(`     • ${tech}: ${count}`);
  }
  console.log(`${'='.repeat(70)}\n`);

  // ✨ SE NÃO ENCONTROU NADA E NÃO HOUVE ERRO, AVISA O USUÁRIO
  if (novosEditais.length === 0 && statusPortais[0]?.sucesso) {
    console.log('ℹ️  Nenhum edital encontrado no Prosas. Verificar credenciais ou disponibilidade do portal.\n');
  }

  return novosEditais;
}

/**
 * Filtra editais classificando-os com IA para remover falsos positivos
 * Mantém apenas editais com confiança >= 70%
 */
export async function filtrarComClassificador(editais: Edital[]): Promise<Edital[]> {
  console.log(`\n🤖 [CLASSIFICAÇÃO] Preparando ${editais.length} itens para análise com IA...`);
  console.log(`   ℹ️ Whitelist removida - todos os editais serão analisados pela IA\n`);

  const editaisValidados: Edital[] = [];

  for (const edital of editais) {
    // Sem whitelist: passar todos os editais para análise com IA
    edital.scorePontuacao = 50; // Score neutro
    edital.nivelPontuacao = 'medio';
    edital.motivosPontuacao = ['Editais passam direto para análise IA'];
    edital.modoAnaliseIA = 'completo'; // Analisar com IA
    edital.foraDoEscopo = false;

    editaisValidados.push(edital);
    console.log(`  ✅ [${edital.id}] passará para análise IA`);
  }

  console.log(`\n📊 Resultado: ${editaisValidados.length} itens selecionados para análise IA`);
  return editaisValidados;
}

function obterDataFutura(dias: number): string {
  const data = new Date();
  data.setDate(data.getDate() + dias);
  return `${String(data.getDate()).padStart(2, '0')}/${String(data.getMonth() + 1).padStart(2, '0')}/${data.getFullYear()}`;
}
