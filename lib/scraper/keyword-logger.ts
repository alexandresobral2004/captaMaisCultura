/**
 * LOGGER DETALHADO DE VALIDAÇÃO COM KEYWORDS
 * 
 * Mantém log estruturado de todas as validações de editais
 * com base em palavras-chave para auditoria e debugging.
 */

import fs from 'fs';
import path from 'path';
import { ResultadoValidacaoKeywords } from './keyword-map';

const LOG_DIR = path.join(process.cwd(), 'data', 'logs', 'validacoes');

/**
 * Interface para entrada de log
 */
export interface EntradaLogValidacao {
  timestamp: string;           // ISO timestamp
  editalId: string;
  fonte: string;              // "prosas", "finep", "cnpq", etc
  titulo?: string;
  resultado: ResultadoValidacaoKeywords;
  tamanhoTexto: number;       // Tamanho do texto em chars
  tempoProcessamento: number; // Em ms
  status: 'aprovado' | 'rejeitado' | 'pendente';
  observacoes?: string;
}

/**
 * Interface para relatório agregado
 */
export interface RelatorioValidacoes {
  dataGeracao: string;
  periodo: {
    inicio: string;
    fim: string;
  };
  total: number;
  aprovados: number;
  rejeitados: number;
  taxaAprovacao: number;
  palavrasChaveMedia: number;
  scoreMediaAprovados: number;
  scoreMediaRejeitados: number;
  entradas: EntradaLogValidacao[];
}

/**
 * Garante que o diretório de logs existe
 */
function garantirDiretorioLogs(): void {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

/**
 * Registra uma validação no log
 */
export function registrarValidacao(
  editalId: string,
  fonte: string,
  resultado: ResultadoValidacaoKeywords,
  tamanhoTexto: number,
  tempoProcessamento: number,
  titulo?: string,
  observacoes?: string
): void {
  try {
    garantirDiretorioLogs();

    const entrada: EntradaLogValidacao = {
      timestamp: new Date().toISOString(),
      editalId,
      fonte,
      titulo,
      resultado,
      tamanhoTexto,
      tempoProcessamento,
      status: resultado.isEdital ? 'aprovado' : 'rejeitado',
      observacoes
    };

    // Arquivo de log diário
    const hoje = new Date().toISOString().split('T')[0];
    const caminhoLog = path.join(LOG_DIR, `validacoes-${hoje}.jsonl`);

    // Append entrada ao arquivo (JSONL format: uma linha por objeto)
    fs.appendFileSync(
      caminhoLog,
      JSON.stringify(entrada) + '\n',
      'utf-8'
    );

    console.log(
      `📝 Log registrado: ${editalId} → ${resultado.isEdital ? '✅' : '❌'}`
    );
  } catch (erro) {
    console.error('❌ Erro ao registrar validação:', erro);
  }
}

/**
 * Gera relatório agregado de validações de um período
 */
export function gerarRelatorioValidacoes(
  dataInicio: Date = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Últimos 7 dias
  dataFim: Date = new Date()
): RelatorioValidacoes {
  try {
    garantirDiretorioLogs();

    const entradas: EntradaLogValidacao[] = [];

    // Ler todos os arquivos de log
    const arquivos = fs.readdirSync(LOG_DIR);
    const arquivosNoIntervalo = arquivos.filter(arquivo => {
      const dataBits = arquivo.match(/validacoes-(\d{4}-\d{2}-\d{2})/);
      if (!dataBits) return false;
      
      const dataArquivo = new Date(dataBits[1]);
      return dataArquivo >= dataInicio && dataArquivo <= dataFim;
    });

    // Processar cada arquivo
    for (const arquivo of arquivosNoIntervalo) {
      const caminhoArquivo = path.join(LOG_DIR, arquivo);
      const conteudo = fs.readFileSync(caminhoArquivo, 'utf-8');
      
      const linhas = conteudo.split('\n').filter(linha => linha.trim());
      for (const linha of linhas) {
        try {
          const entrada = JSON.parse(linha) as EntradaLogValidacao;
          entradas.push(entrada);
        } catch {
          // Ignorar linhas malformadas
        }
      }
    }

    // Calcular estatísticas
    const aprovados = entradas.filter(e => e.status === 'aprovado');
    const rejeitados = entradas.filter(e => e.status === 'rejeitado');

    const scoreMediaAprovados = aprovados.length > 0
      ? aprovados.reduce((sum, e) => sum + e.resultado.scoreTotal, 0) / aprovados.length
      : 0;

    const scoreMediaRejeitados = rejeitados.length > 0
      ? rejeitados.reduce((sum, e) => sum + e.resultado.scoreTotal, 0) / rejeitados.length
      : 0;

    const palavrasChaveMedia = entradas.length > 0
      ? entradas.reduce((sum, e) => sum + e.resultado.palavrasEncontradas.length, 0) / entradas.length
      : 0;

    const relatorio: RelatorioValidacoes = {
      dataGeracao: new Date().toISOString(),
      periodo: {
        inicio: dataInicio.toISOString(),
        fim: dataFim.toISOString()
      },
      total: entradas.length,
      aprovados: aprovados.length,
      rejeitados: rejeitados.length,
      taxaAprovacao: entradas.length > 0
        ? Math.round((aprovados.length / entradas.length) * 100)
        : 0,
      palavrasChaveMedia: Math.round(palavrasChaveMedia * 100) / 100,
      scoreMediaAprovados: Math.round(scoreMediaAprovados * 100) / 100,
      scoreMediaRejeitados: Math.round(scoreMediaRejeitados * 100) / 100,
      entradas
    };

    return relatorio;
  } catch (erro) {
    console.error('❌ Erro ao gerar relatório:', erro);
    return {
      dataGeracao: new Date().toISOString(),
      periodo: {
        inicio: dataInicio.toISOString(),
        fim: dataFim.toISOString()
      },
      total: 0,
      aprovados: 0,
      rejeitados: 0,
      taxaAprovacao: 0,
      palavrasChaveMedia: 0,
      scoreMediaAprovados: 0,
      scoreMediaRejeitados: 0,
      entradas: []
    };
  }
}

/**
 * Exibe relatório formatado no console
 */
export function exibirRelatorioPretty(relatorio: RelatorioValidacoes): void {
  const inicio = new Date(relatorio.periodo.inicio).toLocaleDateString('pt-BR');
  const fim = new Date(relatorio.periodo.fim).toLocaleDateString('pt-BR');

  console.log(`
╔════════════════════════════════════════════════════════════════╗
║          RELATÓRIO DE VALIDAÇÃO COM KEYWORDS                   ║
╠════════════════════════════════════════════════════════════════╣
║ Período: ${inicio} até ${fim}
║ Total processado: ${relatorio.total} editais
║ Aprovados: ${relatorio.aprovados} (${relatorio.taxaAprovacao}%)
║ Rejeitados: ${relatorio.rejeitados} (${100 - relatorio.taxaAprovacao}%)
╠════════════════════════════════════════════════════════════════╣
║ Score médio (aprovados): ${relatorio.scoreMediaAprovados}%
║ Score médio (rejeitados): ${relatorio.scoreMediaRejeitados}%
║ Palavras-chave média: ${relatorio.palavrasChaveMedia}
╚════════════════════════════════════════════════════════════════╝
  `);

  // Mostrar aprovados
  if (relatorio.entradas.filter(e => e.status === 'aprovado').length > 0) {
    console.log('✅ APROVADOS:');
    relatorio.entradas
      .filter(e => e.status === 'aprovado')
      .slice(0, 10) // Mostrar apenas os 10 primeiros
      .forEach(entrada => {
        console.log(
          `   • ${entrada.editalId} (${entrada.fonte}) - Score: ${entrada.resultado.scoreTotal}%`
        );
      });
    if (relatorio.aprovados > 10) {
      console.log(`   ... e ${relatorio.aprovados - 10} mais`);
    }
  }

  // Mostrar rejeitados
  if (relatorio.entradas.filter(e => e.status === 'rejeitado').length > 0) {
    console.log('\n❌ REJEITADOS:');
    relatorio.entradas
      .filter(e => e.status === 'rejeitado')
      .slice(0, 10)
      .forEach(entrada => {
        console.log(
          `   • ${entrada.editalId} (${entrada.fonte}) - Score: ${entrada.resultado.scoreTotal}% (${entrada.resultado.motivo})`
        );
      });
    if (relatorio.rejeitados > 10) {
      console.log(`   ... e ${relatorio.rejeitados - 10} mais`);
    }
  }
}

/**
 * Salva relatório em arquivo JSON
 */
export function salvarRelatorioJSON(
  relatorio: RelatorioValidacoes,
  nomeArquivo?: string
): string {
  try {
    garantirDiretorioLogs();

    const data = new Date().toISOString().split('T')[0];
    const hora = new Date().toISOString().split('T')[1].replace(/[:.]/g, '-').substring(0, 6);
    const nome = nomeArquivo || `relatorio-validacoes-${data}-${hora}.json`;
    
    const caminhoRelatorio = path.join(LOG_DIR, nome);
    fs.writeFileSync(caminhoRelatorio, JSON.stringify(relatorio, null, 2), 'utf-8');

    console.log(`📊 Relatório salvo em: ${caminhoRelatorio}`);
    return caminhoRelatorio;
  } catch (erro) {
    console.error('❌ Erro ao salvar relatório:', erro);
    return '';
  }
}
