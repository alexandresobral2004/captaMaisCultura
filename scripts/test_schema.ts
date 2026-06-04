import * as fs from 'fs';
import * as path from 'path';

// Carregar .env.local manualmente para o script de teste
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf-8');
    envConfig.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        // Remover aspas se houver
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
          value = value.slice(1, -1);
        }
        process.env[key] = value;
      }
    });
    console.log("✅ .env.local carregado com sucesso!");
  }
} catch (e) {
  console.warn("⚠️ Não foi possível carregar .env.local de forma automática:", e);
}

import { analisarEditalComIA } from '../lib/ai/analyzer';

async function main() {
  console.log("=== INICIANDO TESTE DE ANÁLISE IA COM NOVO SCHEMA ===");
  
  // Buscar um edital existente do banco para testar
  const rawDb = require('../lib/db/editais-store');
  const allEditais = await rawDb.getAllEditais(true);
  
  if (allEditais.length === 0) {
    console.log("Nenhum edital encontrado no banco para testar.");
    return;
  }
  
  const edital = allEditais[0];
  console.log(`Edital selecionado: ${edital.id} - ${edital.titulo}`);
  
  try {
    const res = await analisarEditalComIA(edital.id, edital.descricao || "Descrição de teste para validar o schema unificado.", { modo: 'completo' });
    console.log("\n=============================================");
    console.log("✅ Análise executada!");
    console.log("Status de Análise:", res?.statusAnalise);
    console.log("Erro de Análise:", res?.erroAnalise);
    console.log("=============================================");
  } catch (error) {
    console.error("❌ Falha no teste de análise:", error);
  }
}

main();
