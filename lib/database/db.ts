import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import fs from 'fs';
import path from 'path';

// Carregar variáveis de ambiente manualmente se não estiverem definidas (útil no Next.js)
if (!process.env.OPENAI_API_KEY) {
  for (const filename of ['.env.local', 'env.local']) {
    const envPath = path.join(process.cwd(), filename);
    if (fs.existsSync(envPath)) {
      try {
        const envContent = fs.readFileSync(envPath, 'utf-8');
        envContent.split('\n').forEach((line) => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) return;
          // Ignorar se a linha começar com export
          const cleanLine = trimmed.startsWith('export ') ? trimmed.substring(7) : trimmed;
          const parts = cleanLine.split('=');
          if (parts.length >= 2) {
            const key = parts[0].trim();
            const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
            process.env[key] = val;
          }
        });
        console.log(`[DB SETUP] Variáveis de ambiente carregadas do arquivo ${filename}`);
        break;
      } catch (e: any) {
        console.warn(`[DB SETUP] Erro ao ler ${filename}:`, e.message);
      }
    }
  }
}

const DB_PATH = path.join(process.cwd(), 'data', 'db', 'editais.db');

// Garantir que o diretorio existe
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Criar conexao SQLite
const sqlite = new Database(DB_PATH);

// Configuracoes de performance e integridade
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');
sqlite.pragma('synchronous = NORMAL');
sqlite.pragma('cache_size = -64000'); // 64MB cache

// Criar instancia Drizzle
export const db = drizzle(sqlite, { schema });

// Funcao para executar SQL bruto
export function execSQL(sql: string) {
  sqlite.exec(sql);
}

// Funcao para obter a conexao raw
export function getRawDb() {
  return sqlite;
}

// Funcao para configurar FTS5
export function setupFTS() {
  sqlite.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS editais_fts USING fts5(
      titulo,
      descricao,
      conteudo_completo,
      orgao,
      content='editais',
      content_rowid='rowid',
      tokenize="unicode61 remove_diacritics 2"
    );
  `);

  // Criar triggers para manter FTS sincronizado
  sqlite.exec(`
    CREATE TRIGGER IF NOT EXISTS editais_fts_insert AFTER INSERT ON editais BEGIN
      INSERT INTO editais_fts(rowid, titulo, descricao, conteudo_completo, orgao)
      VALUES (new.rowid, new.titulo, new.descricao, new.conteudo_completo, new.orgao);
    END;
  `);

  sqlite.exec(`
    CREATE TRIGGER IF NOT EXISTS editais_fts_delete AFTER DELETE ON editais BEGIN
      DELETE FROM editais_fts WHERE rowid = old.rowid;
    END;
  `);

  sqlite.exec(`DROP TRIGGER IF EXISTS editais_fts_update;`);

  sqlite.exec(`
    CREATE TRIGGER IF NOT EXISTS editais_fts_before_update BEFORE UPDATE ON editais BEGIN
      DELETE FROM editais_fts WHERE rowid = old.rowid;
    END;
  `);

  sqlite.exec(`
    CREATE TRIGGER IF NOT EXISTS editais_fts_after_update AFTER UPDATE ON editais BEGIN
      INSERT INTO editais_fts(rowid, titulo, descricao, conteudo_completo, orgao)
      VALUES (new.rowid, new.titulo, new.descricao, new.conteudo_completo, new.orgao);
    END;
  `);
}

// Funcao para criar tabelas (primeira execucao)
export function createTables() {
  try {
    // Evitar múltiplas inicializações
    sqlite.exec(`
    CREATE TABLE IF NOT EXISTS editais (
      id TEXT PRIMARY KEY,
      titulo TEXT NOT NULL,
      orgao TEXT NOT NULL,
      valor TEXT,
      valor_min REAL,
      valor_max REAL,
      data_publicacao TEXT,
      data_abertura TEXT,
      data_limite TEXT NOT NULL,
      data_resultado TEXT,
      status TEXT NOT NULL DEFAULT 'Aberto',
      status_analise TEXT DEFAULT 'pendente',
      modalidade TEXT,
      abrangencia TEXT,
      tipo_proponente TEXT,
      areas_tematicas TEXT,
      tipo_edital TEXT,
      descricao TEXT,
      link TEXT NOT NULL,
      pdf_url TEXT,
      pdf_path TEXT,
      conteudo_completo TEXT,
      fonte_conteudo TEXT,
      arquivos_anexos TEXT,
      tecnologia_foco TEXT,
      tipo_ferramenta TEXT,
      score_relevancia INTEGER,
      score_confianca_ia INTEGER,
      validado_por_ia INTEGER DEFAULT 0,
      motivo_rejeicao TEXT,
      fora_do_escopo INTEGER DEFAULT 0,
      data_validacao_ia TEXT,
      score_pontuacao INTEGER,
      nivel_pontuacao TEXT,
      motivos_pontuacao TEXT,
      modo_analise_ia TEXT,
      hash_pontuacao TEXT,
      cache_classificacao_usado INTEGER DEFAULT 0,
      confianca_por_campo TEXT,
      categoria_area TEXT NOT NULL DEFAULT 'Cultura',
      criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
      atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

    sqlite.exec(`
    CREATE TABLE IF NOT EXISTS analise_ia (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      edital_id TEXT NOT NULL UNIQUE,
      resumo TEXT,
      objetivo TEXT,
      elegibilidade TEXT,
      contato_edital TEXT,
      score_adequacao INTEGER,
      secoes_requeridas TEXT,
      criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
      atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (edital_id) REFERENCES editais(id) ON DELETE CASCADE
    );
  `);

    sqlite.exec(`
    CREATE TABLE IF NOT EXISTS analise_requisitos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      analise_id INTEGER NOT NULL,
      requisito TEXT NOT NULL,
      ordem INTEGER DEFAULT 0,
      FOREIGN KEY (analise_id) REFERENCES analise_ia(id) ON DELETE CASCADE
    );
  `);

    sqlite.exec(`
    CREATE TABLE IF NOT EXISTS analise_itens_financiaveis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      analise_id INTEGER NOT NULL,
      item TEXT NOT NULL,
      ordem INTEGER DEFAULT 0,
      FOREIGN KEY (analise_id) REFERENCES analise_ia(id) ON DELETE CASCADE
    );
  `);

    sqlite.exec(`
    CREATE TABLE IF NOT EXISTS analise_documentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      analise_id INTEGER NOT NULL,
      documento TEXT NOT NULL,
      ordem INTEGER DEFAULT 0,
      FOREIGN KEY (analise_id) REFERENCES analise_ia(id) ON DELETE CASCADE
    );
  `);

    sqlite.exec(`
    CREATE TABLE IF NOT EXISTS analise_criterios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      analise_id INTEGER NOT NULL,
      criterio TEXT NOT NULL,
      ordem INTEGER DEFAULT 0,
      FOREIGN KEY (analise_id) REFERENCES analise_ia(id) ON DELETE CASCADE
    );
  `);

    sqlite.exec(`
    CREATE TABLE IF NOT EXISTS analise_pontos_fracos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      analise_id INTEGER NOT NULL,
      ponto_fraco TEXT NOT NULL,
      ordem INTEGER DEFAULT 0,
      FOREIGN KEY (analise_id) REFERENCES analise_ia(id) ON DELETE CASCADE
    );
  `);

    sqlite.exec(`
    CREATE TABLE IF NOT EXISTS palavras_chave (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      edital_id TEXT NOT NULL,
      palavra TEXT NOT NULL,
      frequencia INTEGER DEFAULT 1,
      FOREIGN KEY (edital_id) REFERENCES editais(id) ON DELETE CASCADE
    );
  `);

    sqlite.exec(`
    CREATE TABLE IF NOT EXISTS arquivos_anexos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      edital_id TEXT NOT NULL,
      descricao TEXT,
      url TEXT,
      tipo TEXT,
      caminho_local TEXT,
      tamanho_bytes INTEGER,
      hash_arquivo TEXT,
      criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (edital_id) REFERENCES editais(id) ON DELETE CASCADE
    );
  `);

    sqlite.exec(`
    CREATE TABLE IF NOT EXISTS motivos_pontuacao (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      edital_id TEXT NOT NULL,
      motivo TEXT NOT NULL,
      fonte TEXT NOT NULL DEFAULT 'whitelist',
      score_parcial INTEGER,
      score_final INTEGER,
      detalhes TEXT,
      criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (edital_id) REFERENCES editais(id) ON DELETE CASCADE
    );
  `);

    sqlite.exec(`
    CREATE TABLE IF NOT EXISTS areas_tematicas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE
    );
  `);

    sqlite.exec(`
    CREATE TABLE IF NOT EXISTS tipos_proponente (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE
    );
  `);

    sqlite.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'leitor',
      status TEXT NOT NULL DEFAULT 'ativo',
      criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
      atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

    sqlite.exec(`
    CREATE TABLE IF NOT EXISTS projetos (
      id TEXT PRIMARY KEY,
      edital_id TEXT NOT NULL,
      titulo TEXT NOT NULL,
      descricao TEXT,
      area_atuacao TEXT,
      proposta_usuario TEXT,
      resumo_executivo TEXT,
      justificativa TEXT,
      objetivos TEXT,
      metodologia TEXT,
      resultados_esperados TEXT,
      cronograma TEXT,
      orcamento_detalhado TEXT,
      valor_solicitado REAL,
      prazo_meses INTEGER,
      equipe TEXT,
      criterios_atendidos TEXT,
      criterios_pendentes TEXT,
      score_compliance INTEGER,
      status TEXT DEFAULT 'rascunho',
      versao INTEGER DEFAULT 1,
      prompt_original TEXT,
      fontes TEXT,
      secoes_dinamicas TEXT,
      logo_url TEXT,
      logo_descricao TEXT,
      dados_proponente TEXT,
      criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
      atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (edital_id) REFERENCES editais(id) ON DELETE CASCADE
    );
  `);

    sqlite.exec(`
    CREATE TABLE IF NOT EXISTS logs_sistema (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nivel TEXT NOT NULL CHECK(nivel IN ('error', 'warning', 'info')),
      mensagem TEXT NOT NULL,
      cenario_falha TEXT,
      acao_tomada TEXT CHECK(acao_tomada IN ('retry', 'mark_error', 'human_review', 'skip', 'fallback', 'ignore')),
      repeticoes INTEGER DEFAULT 0,
      contexto TEXT,
      caminho TEXT,
      detalhes TEXT,
      usuario_id TEXT,
      ip TEXT,
      user_agent TEXT,
      criado_em TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

    sqlite.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'PENDENTE',
      fase TEXT,
      total_encontrados INTEGER DEFAULT 0,
      total_validados INTEGER DEFAULT 0,
      total_downloads INTEGER DEFAULT 0,
      total_analisados INTEGER DEFAULT 0,
      total_erros INTEGER DEFAULT 0,
      erro_detalhes TEXT,
      iniciado_em TEXT NOT NULL,
      finalizado_em TEXT,
      atualizado_em TEXT NOT NULL
    );
  `);

    sqlite.exec(`
    CREATE TABLE IF NOT EXISTS portais (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      url_busca TEXT NOT NULL,
      urls_fallback TEXT,
      tipo TEXT NOT NULL CHECK(tipo IN ('rss', 'html', 'api', 'session')),
      categoria TEXT NOT NULL,
      ativo INTEGER DEFAULT 1,
      scraper_module TEXT,
      intervalo_minutos INTEGER DEFAULT 60,
      ultimo_scan TEXT,
      cred_email TEXT,
      criado_em TEXT NOT NULL,
      atualizado_em TEXT NOT NULL
    );
  `);

    // Criar indices
    sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_editais_status ON editais(status);`);
    sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_editais_data_limite ON editais(data_limite);`);
    sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_editais_orgao ON editais(orgao);`);
    sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_editais_score ON editais(score_relevancia);`);
    sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_editais_tecnologia ON editais(tecnologia_foco);`);
    sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_editais_criado_em ON editais(criado_em);`);
    sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_palavras_edital ON palavras_chave(edital_id);`);
    sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_arquivos_edital ON arquivos_anexos(edital_id);`);
    sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_projetos_edital_id ON projetos(edital_id);`);
    sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_projetos_status ON projetos(status);`);
    sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_projetos_criado_em ON projetos(criado_em);`);
    sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_logs_nivel ON logs_sistema(nivel);`);
    sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_logs_criado_em ON logs_sistema(criado_em);`);
    sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_logs_contexto ON logs_sistema(contexto);`);
    sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_logs_cenario ON logs_sistema(cenario_falha);`);
    sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_logs_acao ON logs_sistema(acao_tomada);`);
    sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);`);
    sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_jobs_iniciado_em ON jobs(iniciado_em);`);
    sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_motivos_edital_fonte ON motivos_pontuacao(edital_id, fonte);`);
    sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_motivos_fonte ON motivos_pontuacao(fonte);`);

    // Setup FTS
    setupFTS();
  } catch (error) {
    console.warn('Erro ao criar tabelas do banco:', error);
  }
}

// Migração: adicionar colunas novas que podem não existir em bancos antigos
function migrateSchema() {
  try {
    // Migração da tabela editais
    const columns = sqlite.prepare("PRAGMA table_info(editais)").all() as any[];

    const hasDataAbertura = columns.some((col: any) => col.name === 'data_abertura');
    if (!hasDataAbertura) {
      sqlite.exec(`ALTER TABLE editais ADD COLUMN data_abertura TEXT`);
      console.log('✅ Migração: coluna data_abertura adicionada');
    }

    const hasConfiancaPorCampo = columns.some((col: any) => col.name === 'confianca_por_campo');
    if (!hasConfiancaPorCampo) {
      sqlite.exec(`ALTER TABLE editais ADD COLUMN confianca_por_campo TEXT`);
      console.log('✅ Migração: coluna confianca_por_campo adicionada');
    }

    // Migração: adicionar coluna codigo na tabela editais
    const hasCodigo = columns.some((col: any) => col.name === 'codigo');
    if (!hasCodigo) {
      sqlite.exec(`ALTER TABLE editais ADD COLUMN codigo TEXT UNIQUE`);
      console.log('✅ Migração: coluna codigo adicionada à tabela editais');
    }

    // Migração: adicionar coluna fontes na tabela projetos
    const projColumns = sqlite.prepare("PRAGMA table_info(projetos)").all() as any[];
    const hasFontes = projColumns.some((col: any) => col.name === 'fontes');
    if (!hasFontes) {
      sqlite.exec(`ALTER TABLE projetos ADD COLUMN fontes TEXT`);
      console.log('✅ Migração: coluna fontes adicionada à tabela projetos');
    }

    const hasSecoesDinamicas = projColumns.some((col: any) => col.name === 'secoes_dinamicas');
    if (!hasSecoesDinamicas) {
      sqlite.exec(`ALTER TABLE projetos ADD COLUMN secoes_dinamicas TEXT`);
      console.log('✅ Migração: coluna secoes_dinamicas adicionada à tabela projetos');
    }

    // Migração: adicionar coluna logo_url na tabela projetos
    const hasLogoUrl = projColumns.some((col: any) => col.name === 'logo_url');
    if (!hasLogoUrl) {
      sqlite.exec(`ALTER TABLE projetos ADD COLUMN logo_url TEXT`);
      console.log('✅ Migração: coluna logo_url adicionada à tabela projetos');
    }

    // Migração: adicionar coluna logo_descricao na tabela projetos
    const hasLogoDescricao = projColumns.some((col: any) => col.name === 'logo_descricao');
    if (!hasLogoDescricao) {
      sqlite.exec(`ALTER TABLE projetos ADD COLUMN logo_descricao TEXT`);
      console.log('✅ Migração: coluna logo_descricao adicionada à tabela projetos');
    }

    // Migração: adicionar coluna dados_proponente na tabela projetos
    const hasDadosProponente = projColumns.some((col: any) => col.name === 'dados_proponente');
    if (!hasDadosProponente) {
      sqlite.exec(`ALTER TABLE projetos ADD COLUMN dados_proponente TEXT`);
      console.log('✅ Migração: coluna dados_proponente adicionada à tabela projetos');
    }

    // Migração: adicionar coluna secoes_requeridas na tabela analise_ia
    const analiseIaColumns = sqlite.prepare("PRAGMA table_info(analise_ia)").all() as any[];
    const hasSecoesRequeridas = analiseIaColumns.some((col: any) => col.name === 'secoes_requeridas');
    if (!hasSecoesRequeridas) {
      sqlite.exec(`ALTER TABLE analise_ia ADD COLUMN secoes_requeridas TEXT`);
      console.log('✅ Migração: coluna secoes_requeridas adicionada à tabela analise_ia');
    }

    // Migração: adicionar colunas na tabela logs_sistema
    const logColumns = sqlite.prepare("PRAGMA table_info(logs_sistema)").all() as any[];

    const hasCenarioFalha = logColumns.some((col: any) => col.name === 'cenario_falha');
    if (!hasCenarioFalha) {
      sqlite.exec(`ALTER TABLE logs_sistema ADD COLUMN cenario_falha TEXT`);
      console.log('✅ Migração: coluna cenario_falha adicionada à tabela logs_sistema');
    }

    const hasAcaoTomada = logColumns.some((col: any) => col.name === 'acao_tomada');
    if (!hasAcaoTomada) {
      sqlite.exec(`ALTER TABLE logs_sistema ADD COLUMN acao_tomada TEXT CHECK(acao_tomada IN ('retry', 'mark_error', 'human_review', 'skip', 'fallback', 'ignore'))`);
      console.log('✅ Migração: coluna acao_tomada adicionada à tabela logs_sistema');
    }

    const hasRepeticoes = logColumns.some((col: any) => col.name === 'repeticoes');
    if (!hasRepeticoes) {
      sqlite.exec(`ALTER TABLE logs_sistema ADD COLUMN repeticoes INTEGER DEFAULT 0`);
      console.log('✅ Migração: coluna repeticoes adicionada à tabela logs_sistema');
    }

    // Migração: adicionar tabela jobs
    const jobsTableInfo = sqlite.prepare("PRAGMA table_info(jobs)").all() as any[];
    if (jobsTableInfo.length === 0) {
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS jobs (
          id TEXT PRIMARY KEY,
          status TEXT NOT NULL DEFAULT 'PENDENTE',
          fase TEXT,
          total_encontrados INTEGER DEFAULT 0,
          total_validados INTEGER DEFAULT 0,
          total_downloads INTEGER DEFAULT 0,
          total_analisados INTEGER DEFAULT 0,
          total_erros INTEGER DEFAULT 0,
          erro_detalhes TEXT,
          iniciado_em TEXT NOT NULL,
          finalizado_em TEXT,
          atualizado_em TEXT NOT NULL
        );
      `);
      sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);`);
      sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_jobs_iniciado_em ON jobs(iniciado_em);`);
      console.log('✅ Migração: tabela jobs adicionada');
    }
    // Migração: adicionar colunas na tabela motivos_pontuacao
    const motivosColumns = sqlite.prepare("PRAGMA table_info(motivos_pontuacao)").all() as any[];

    const hasMotivosFonte = motivosColumns.some((col: any) => col.name === 'fonte');
    if (!hasMotivosFonte) {
      sqlite.exec(`ALTER TABLE motivos_pontuacao ADD COLUMN fonte TEXT NOT NULL DEFAULT 'whitelist'`);
      console.log('✅ Migração: coluna fonte adicionada à tabela motivos_pontuacao');
    }

    const hasMotivosScoreParcial = motivosColumns.some((col: any) => col.name === 'score_parcial');
    if (!hasMotivosScoreParcial) {
      sqlite.exec(`ALTER TABLE motivos_pontuacao ADD COLUMN score_parcial INTEGER`);
      console.log('✅ Migração: coluna score_parcial adicionada à tabela motivos_pontuacao');
    }

    const hasMotivosScoreFinal = motivosColumns.some((col: any) => col.name === 'score_final');
    if (!hasMotivosScoreFinal) {
      sqlite.exec(`ALTER TABLE motivos_pontuacao ADD COLUMN score_final INTEGER`);
      console.log('✅ Migração: coluna score_final adicionada à tabela motivos_pontuacao');
    }

    const hasMotivosDetalhes = motivosColumns.some((col: any) => col.name === 'detalhes');
    if (!hasMotivosDetalhes) {
      sqlite.exec(`ALTER TABLE motivos_pontuacao ADD COLUMN detalhes TEXT`);
      console.log('✅ Migração: coluna detalhes adicionada à tabela motivos_pontuacao');
    }

    const hasMotivosCriadoEm = motivosColumns.some((col: any) => col.name === 'criado_em');
    if (!hasMotivosCriadoEm) {
      sqlite.exec(`ALTER TABLE motivos_pontuacao ADD COLUMN criado_em TEXT DEFAULT CURRENT_TIMESTAMP`);
      console.log('✅ Migração: coluna criado_em adicionada à tabela motivos_pontuacao');
    }

    // Migração: adicionar coluna deleted_at na tabela editais
    const hasDeletedAt = columns.some((col: any) => col.name === 'deleted_at');
    if (!hasDeletedAt) {
      sqlite.exec(`ALTER TABLE editais ADD COLUMN deleted_at TEXT`);
      console.log('✅ Migração: coluna deleted_at adicionada à tabela editais');
    }

    // Migração: adicionar coluna categoria_area na tabela editais
    const hasCategoriaArea = columns.some((col: any) => col.name === 'categoria_area');
    if (!hasCategoriaArea) {
      sqlite.exec(`ALTER TABLE editais ADD COLUMN categoria_area TEXT NOT NULL DEFAULT 'Cultura'`);
      console.log('✅ Migração: coluna categoria_area adicionada à tabela editais');
    }

    // Migração: adicionar índices de motivos
    try {
      sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_motivos_edital_fonte ON motivos_pontuacao(edital_id, fonte)`);
      sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_motivos_fonte ON motivos_pontuacao(fonte)`);
      sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_editais_deleted_at ON editais(deleted_at)`);
    } catch (_) { /* índice já existe */ }

    // Migração: adicionar tabela portais
    const portaisTableInfo = sqlite.prepare("PRAGMA table_info(portais)").all() as any[];
    if (portaisTableInfo.length === 0) {
      sqlite.exec(`
        CREATE TABLE portais (
          id TEXT PRIMARY KEY,
          nome TEXT NOT NULL,
          url_busca TEXT NOT NULL,
          urls_fallback TEXT,
          tipo TEXT NOT NULL CHECK(tipo IN ('rss', 'html', 'api', 'session')),
          categoria TEXT NOT NULL,
          ativo INTEGER DEFAULT 1,
          scraper_module TEXT,
          intervalo_minutos INTEGER DEFAULT 60,
          ultimo_scan TEXT,
          cred_email TEXT,
          criado_em TEXT NOT NULL,
          atualizado_em TEXT NOT NULL
        )
      `);
      sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_portais_ativo ON portais(ativo)`);
      sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_portais_categoria ON portais(categoria)`);
      console.log('✅ Migração: tabela portais adicionada');
    }

    // Migração: adicionar tabelas de prompts de IA
    const promptsSistemaTableInfo = sqlite.prepare("PRAGMA table_info(prompts_sistema)").all() as any[];
    if (promptsSistemaTableInfo.length === 0) {
      sqlite.exec(`
        CREATE TABLE prompts_sistema (
          id TEXT PRIMARY KEY,
          modulo TEXT NOT NULL,
          chave TEXT NOT NULL,
          conteudo_padrao TEXT NOT NULL,
          descricao TEXT,
          criado_em TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);
      sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_prompts_sistema_modulo ON prompts_sistema(modulo)`);
      sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_prompts_sistema_chave ON prompts_sistema(chave)`);
      sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_prompts_sistema_modulo_chave ON prompts_sistema(modulo, chave)`);
      console.log('✅ Migração: tabela prompts_sistema adicionada');
    }

    const promptsCustomizadosTableInfo = sqlite.prepare("PRAGMA table_info(prompts_customizados)").all() as any[];
    if (promptsCustomizadosTableInfo.length === 0) {
      sqlite.exec(`
        CREATE TABLE prompts_customizados (
          id TEXT PRIMARY KEY,
          prompt_sistema_id TEXT REFERENCES prompts_sistema(id),
          conteudo TEXT NOT NULL,
          ativo INTEGER DEFAULT 1,
          criado_por TEXT REFERENCES usuarios(id),
          criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
          atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);
      sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_prompts_customizados_sistema_id ON prompts_customizados(prompt_sistema_id)`);
      sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_prompts_customizados_ativo ON prompts_customizados(ativo)`);
      console.log('✅ Migração: tabela prompts_customizados adicionada');
    }

    const promptsHistoricoTableInfo = sqlite.prepare("PRAGMA table_info(prompts_historico)").all() as any[];
    if (promptsHistoricoTableInfo.length === 0) {
      sqlite.exec(`
        CREATE TABLE prompts_historico (
          id TEXT PRIMARY KEY,
          prompt_customizado_id TEXT REFERENCES prompts_customizados(id),
          conteudo_anterior TEXT NOT NULL,
          conteudo_novo TEXT NOT NULL,
          alterado_por TEXT REFERENCES usuarios(id),
          alterado_em TEXT DEFAULT CURRENT_TIMESTAMP,
          justificativa TEXT
        )
      `);
      sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_prompts_historico_customizado_id ON prompts_historico(prompt_customizado_id)`);
      sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_prompts_historico_alterado_em ON prompts_historico(alterado_em)`);
      console.log('✅ Migração: tabela prompts_historico adicionada');
    }

    // Migração: normalizar datas limites antigas no formato DD/MM/YYYY para YYYY-MM-DD
    try {
      sqlite.exec(`
        UPDATE editais 
        SET data_limite = substr(data_limite, 7, 4) || '-' || substr(data_limite, 4, 2) || '-' || substr(data_limite, 1, 2)
        WHERE data_limite LIKE '__/__/____';
      `);
      console.log('✅ Migração: datas limites antigas normalizadas para YYYY-MM-DD');
    } catch (err: any) {
      console.warn('Erro ao normalizar datas limites no banco:', err.message);
    }

  } catch (error: any) {
    // Coluna já existe ou outro erro irrelevante — silenciar
    if (!error.message?.includes('duplicate column')) {
      console.warn('Erro na migração:', error.message);
    }
  }
}

// Inicializar tabelas na primeira execucao (server-side only)
let initialized = false;

if (typeof window === 'undefined') {
  try {
    if (!initialized) {
      initialized = true;
      createTables();
      migrateSchema();
    }
  } catch (error) {
    console.warn('Erro ao criar tabelas:', error);
  }
}
