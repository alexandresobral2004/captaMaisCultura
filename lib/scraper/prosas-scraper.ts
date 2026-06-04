import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { Edital, parseDateString, isEditalExcluido } from '../db/editais-store';
import { validarComOpenAI, validarBlacklist, validarWhitelistTI } from './filtros-ti';
import { pipelineLogger } from './pipeline-logger';
import { logger, LogCenarioFalha, LogAcao } from '../logger';

const SESSION_FILE = path.join(process.cwd(), 'data', 'prosas-session.json');

/**
 * Carrega a sessão salva, se existir e não estiver expirada.
 * Sessões expiram após 8 horas.
 */
function carregarSessaoSalva(): string[] | null {
  if (fs.existsSync(SESSION_FILE)) {
    try {
      const data = fs.readFileSync(SESSION_FILE, 'utf8');
      const session = JSON.parse(data);
      
      // Validar timestamp da sessão
      if (session && session.dataGeracao) {
        const agora = Date.now();
        const dataSessao = new Date(session.dataGeracao).getTime();
        const idadeMinutos = (agora - dataSessao) / 1000 / 60;
        const expiracaoMinutos = 8 * 60; // 8 horas
        
        console.log(`📋 [PROSAS] Sessão tem ${idadeMinutos.toFixed(1)} minutos (expira em ${expiracaoMinutos} min)`);
        
        if (idadeMinutos > expiracaoMinutos) {
          console.warn(`⚠️ [PROSAS] Sessão expirada! Deletando arquivo obsoleto...`);
          fs.unlinkSync(SESSION_FILE);
          return null;
        }
      }
      
      if (session && session.cookies && Array.isArray(session.cookies)) {
        console.log(`✅ [PROSAS] Sessão válida carregada (${session.cookies.length} cookies)`);
        return session.cookies;
      }
    } catch (e) {
      console.error('Erro ao ler sessão Prosas:', e);
    }
  }
  return null;
}

/**
 * Salva a sessão no disco para reutilização.
 */
function salvarSessao(cookies: string[]) {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  fs.writeFileSync(SESSION_FILE, JSON.stringify({ cookies, dataGeracao: new Date().toISOString() }, null, 2), 'utf8');
}

/**
 * Realiza o login na plataforma Prosas simulando o formulário web.
 */
async function realizarLoginProsas(): Promise<string[]> {
  const email = process.env.PROSAS_EMAIL;
  const password = process.env.PROSAS_PASSWORD;

  if (!email || !password) {
    throw new Error('Credenciais do Prosas (PROSAS_EMAIL, PROSAS_PASSWORD) não encontradas no .env.local');
  }

  console.log('🔑 [PROSAS] Iniciando fluxo de autenticação por formulário...');
  
  // 1. Acessa a página de login para obter cookies iniciais (ex: CSRF, sessão)
  const loginPageResponse = await axios.get('https://prosas.com.br/users/sign_in');
  let cookies = loginPageResponse.headers['set-cookie'] || [];
  
  // Extrai o authenticity_token (CSRF) se existir no HTML
  const $ = cheerio.load(loginPageResponse.data);
  const authenticityToken = $('meta[name="csrf-token"]').attr('content');

  // Prepara o formulário de login (pode variar se a rota de login exata for outra)
  // De acordo com a estrutura Rails/Prosas
  const formData = new URLSearchParams();
  formData.append('user[email]', email);
  formData.append('user[password]', password);
  formData.append('commit', 'Entrar');
  if (authenticityToken) {
    formData.append('authenticity_token', authenticityToken);
  }

  // 2. Envia o POST de login
  try {
    const authResponse = await axios.post('https://prosas.com.br/users/sign_in', formData.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookies.join('; '),
        'Origin': 'https://prosas.com.br',
        'Referer': 'https://prosas.com.br/login',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      maxRedirects: 0, // Impede o axios de seguir o redirect 302 logo após o login para podermos pegar os cookies de autorização
      validateStatus: (status) => status >= 200 && status < 400
    });

    const newCookies = authResponse.headers['set-cookie'];
    if (newCookies) {
      cookies = [...cookies, ...newCookies];
    }
    
    salvarSessao(cookies);
    console.log('✅ [PROSAS] Login realizado com sucesso. Sessão armazenada.');
    return cookies;

  } catch (error: any) {
    // Axios lança erro se o status for fora do range validateStatus
    // Um 302 Redirect após login geralmente significa sucesso em aplicações Rails
    if (error.response && [301, 302].includes(error.response.status)) {
       const newCookies = error.response.headers['set-cookie'];
       if (newCookies) {
         cookies = [...cookies, ...newCookies];
       }
       salvarSessao(cookies);
       console.log('✅ [PROSAS] Login realizado com sucesso (Redirect detectado). Sessão armazenada.');
       return cookies;
    }

    const errorMsg = `Falha no login do Prosas: ${error.message}`;
    console.error(`❌ ${errorMsg}`);

    await logger.logError(
      errorMsg,
      'autenticacao_prosas',
      'retry',
      {
        status: error.response?.status,
        statusText: error.response?.statusText,
        hasEmail: !!email,
      }
    );

    throw new Error(errorMsg);
  }
}

/**
 * Busca os editais usando a sessão ativa.
 */
export async function buscarEditaisProsas(): Promise<Edital[]> {
  let cookies = carregarSessaoSalva();

  if (!cookies) {
    cookies = await realizarLoginProsas();
  }

  try {
    return await tentarBuscaComSessao(cookies);
  } catch (error: any) {
    console.warn(`[PROSAS] Falha na busca com sessão atual (${error.message}). Tentando re-autenticar...`);
    // Se falhar (ex: 401 Unauthorized), a sessão pode ter expirado. Tenta logar de novo.
    cookies = await realizarLoginProsas();
    return await tentarBuscaComSessao(cookies);
  }
}

async function tentarBuscaComSessao(cookies: string[] | null): Promise<Edital[]> {
  const agora = new Date();
  const editais: Edital[] = [];
  let rejeitados = 0;
  
  console.log('🌐 [PROSAS] Solicitando token de acesso (OAuth2 Client Credentials)...');
  
  let token: string;
  try {
    const tokenRes = await axios.post('https://prosas.com.br/auth/oauth2/token', {
      grant_type: 'client_credentials',
      client_id: 'lsf6jeu7-Wk04P2iSYMdcMhPZUNZqabK8CG6mAfRQ6M',
      scope: 'public'
    });
    token = tokenRes.data.access_token;
  } catch (e: any) {
    const errorMsg = `[PROSAS] Falha ao obter token de acesso: ${e.message}`;
    console.error(`❌ ${errorMsg}`);

    await logger.logError(
      errorMsg,
      'autenticacao_prosas',
      'retry',
      {
        status: e.response?.status,
        url: 'https://prosas.com.br/auth/oauth2/token'
      }
    );

    throw new Error(errorMsg);
  }

   console.log('🌐 [PROSAS] Extraindo dados via API V2...');

    try {
      console.log(`[PROSAS] Iniciando busca com tratamento robusto de erros...`);
      pipelineLogger.logBusca(`PROSAS: Iniciando busca de editais ativos...`);
      const response = await axios.get('https://prosas.com.br/selecao/api/v2/third_party/oportunidades/inscricoes_abertas', {
       headers: {
         'Authorization': `Bearer ${token}`,
         'Accept': 'application/json'
       },
       params: {
         'include': 'area_interesses,incentivador',
         'page[page]': 1,
         'page[size]': 50
       }
     });
     
     console.log(`[DEBUG] Status da resposta: ${response.status}`);
     console.log(`[DEBUG] Estrutura da resposta:`, Object.keys(response.data));
     console.log(`[DEBUG] response.data.data:`, response.data.data ? `Array com ${response.data.data.length} itens` : 'undefined/null');
     
     if (response.data && response.data.data) {
       const processos = response.data.data;
       console.log(`[PROSAS] ${processos.length} editais retornados pela API V2. Buscando detalhes com arquivos...`);
       
       if (processos.length > 0) {
         console.log(`[DEBUG] Estrutura do primeiro item:`, JSON.stringify(processos[0], null, 2).substring(0, 200));
       } else {
         console.warn(`⚠️ [PROSAS] API retornou resposta válida mas array vazio!`);
         console.log(`[DEBUG] Resposta completa (primeiros 500 chars):`, JSON.stringify(response.data, null, 2).substring(0, 500));
       }

      // Buscar TODOS os editais com paginação
      let paginaAtual = 1;
      let todasAsPaginas = processos;
      const totalEditais: Edital[] = [];

       // Se houver links de paginação, continuar buscando
        if (response.data.links && response.data.links.last) {
          try {
            const linkLast = String(response.data.links.last).trim();
            const ultimaPagina = new URL(linkLast).searchParams.get('page[page]');
            const totalPaginasDetectadas = ultimaPagina ? parseInt(ultimaPagina) : 1;
            const totalPaginas = Math.min(Number.isFinite(totalPaginasDetectadas) ? totalPaginasDetectadas : 1, 10);

         if (totalPaginasDetectadas > 10) {
           console.warn(`📄 [PROSAS] Total de páginas (${totalPaginasDetectadas}) acima do limite. Processando primeiras ${totalPaginas}.`);
         }

         console.log(`📄 [PROSAS] Total de páginas detectadas: ${totalPaginasDetectadas}. Buscando até ${totalPaginas} páginas...`);

         for (let pagina = 2; pagina <= totalPaginas; pagina++) {
           const proxPagina = await axios.get('https://prosas.com.br/selecao/api/v2/third_party/oportunidades/inscricoes_abertas', {
             headers: {
               'Authorization': `Bearer ${token}`,
               'Accept': 'application/json'
             },
             params: {
               'include': 'area_interesses,incentivador',
               'page[page]': pagina,
               'page[size]': 50
             }
           });
           
           if (proxPagina.data && proxPagina.data.data) {
             todasAsPaginas = todasAsPaginas.concat(proxPagina.data.data);
             console.log(`  [${pagina}/${totalPaginasDetectadas}] +${proxPagina.data.data.length} editais carregados`);
           }

            // Rate limiting: 500ms entre requests
            await new Promise(res => setTimeout(res, 500));
          }
          } catch (paginationErr: any) {
            console.warn(`[PROSAS] Erro ao processar paginação: ${paginationErr.message}. Processando apenas primeira página.`);
          }
        }

       console.log(`[PROSAS] Total de ${todasAsPaginas.length} editais carregados. Buscando detalhes individuais...`);

        // Para CADA edital, buscar detalhes com arquivos
        for (let idx = 0; idx < todasAsPaginas.length; idx++) {
          try {
          const item = todasAsPaginas[idx];
          
          // Validação: item pode ser um objeto com estrutura inesperada
          let itemId: string | undefined;
           // Pode ter estrutura { id: "123" } ou { attributes: { id: "123" } }
           if (item.id) {
             itemId = String(item.id).trim();
           } else if (item.attributes && item.attributes.id) {
             itemId = String(item.attributes.id).trim();
           }
           
           if (!itemId) {
             console.log(`  [${idx + 1}/${todasAsPaginas.length}] ⚠️ ID não encontrado na estrutura:`, Object.keys(item).slice(0, 5));
             continue;
           }
           const idEdital = `prosas-${itemId}`;

           // Buscar detalhe individual com include=arquivos,sites
           const urlDetalhe = `https://prosas.com.br/selecao/api/v2/third_party/oportunidades/${itemId}`;
           const detalheResponse = await axios.get(
             urlDetalhe,
             {
               headers: {
                 'Authorization': `Bearer ${token}`,
                 'Accept': 'application/json'
               },
               params: {
                 'include': 'arquivos,sites'
               },
               timeout: 30000,
               validateStatus: (status) => status >= 200 && status < 400
             }
           );

           const detalhe = detalheResponse.data?.data;
           if (!detalhe) {
             console.log(`  [${idx + 1}/${todasAsPaginas.length}] ⚠️ Resposta sem detalhe. Pulando.`);
             continue;
           }
           
           const proc = detalhe.attributes;

          // Formatar data final
          let dataLimiteObj = null;
          if (proc.data_limite_inscricao_sem_rascunho || proc.encerramento_das_inscricoes) {
            dataLimiteObj = new Date(proc.data_limite_inscricao_sem_rascunho || proc.encerramento_das_inscricoes);
          }

          // TRAVA DE DATA
          if (dataLimiteObj && dataLimiteObj < agora) {
            console.log(`  [${idx + 1}/${todasAsPaginas.length}] ⏭️ Edital ${item.id} expirado. Pulando.`);
            continue;
          }

          // Extrair URL do PDF do S3 (se houver arquivos)
          let pdfUrlS3: string | undefined = undefined;
          const arquivosAnexos: { descricao: string; url: string; tipo: string }[] = [];

          if (detalheResponse.data.included) {
            // Processar arquivos inclusos
            const arquivos = detalheResponse.data.included.filter((inc: any) => inc.type === 'arquivo');
            
            for (const arquivo of arquivos) {
              const fileAttrs = arquivo.attributes;
              const fileUrl = fileAttrs.url;
              const fileNome = fileAttrs.nome || fileAttrs.nome_arquivo || 'Arquivo';
              
              // Extrair extensão
              const extensao = (fileNome || '').split('.').pop()?.toLowerCase() || 'pdf';

              if (fileUrl) {
                arquivosAnexos.push({
                  descricao: fileNome,
                  url: fileUrl,
                  tipo: extensao
                });

                // Se for PDF, priorizar como pdfUrlS3
                if (extensao === 'pdf' && !pdfUrlS3) {
                  pdfUrlS3 = fileUrl;
                  console.log(`    📎 Arquivo PDF do S3 encontrado: ${fileNome}`);
                }
              }
            }
          }

          // Extrair link externo (se houver)
          let linkExterno: string | undefined = undefined;
          if (proc.link && typeof proc.link === 'string' && proc.link.trim()) {
            linkExterno = proc.link.trim();
          }

          // Verificar se o edital já está inativo/excluído no banco de dados
          const isExcluido = await isEditalExcluido(idEdital, linkExterno || `https://prosas.com.br/editais/${itemId}`);
          if (isExcluido) {
            console.log(`  [${idx + 1}/${todasAsPaginas.length}] ⏭️ Edital ${idEdital} já está excluído no banco de dados. Pulando.`);
            continue;
          }

           // ✨ NOVO: Validação TI com Whitelist + OpenAI
           let validacaoWhitelist;
           try {
             validacaoWhitelist = validarWhitelistTI(proc.nome, proc.descricao || '');
           } catch (err) {
             console.log(`  [${idx + 1}/${todasAsPaginas.length}] ⚠️ Erro na whitelist: ${(err as Error).message}`);
             continue;
           }
           
           // Se não passou na whitelist, pular
           if (!validacaoWhitelist.válido) {
            console.log(`  [${idx + 1}/${todasAsPaginas.length}] ❌ Rejeitado (sem termo TI): ${proc.nome.substring(0, 40)}`);
            pipelineLogger.logWhitelist(idEdital, proc.nome, false, validacaoWhitelist.confidence || 'baixa', validacaoWhitelist.termosBranco || []);
            pipelineLogger.logResultado(idEdital, proc.nome, 'rejeitado', 'Whitelist');
            continue;
          }
          
          pipelineLogger.logWhitelist(idEdital, proc.nome, true, validacaoWhitelist.confidence || 'alta', validacaoWhitelist.termosBranco || []);
           
           // ✨ NOVO: Chamar OpenAI para validação completa
            let validacaoIA;
            try {
              console.log(`  [${idx + 1}/${todasAsPaginas.length}] 🤖 Validando com OpenAI: ${proc.nome.substring(0, 40)}...`);
              validacaoIA = await validarComOpenAI(
                proc.nome,
                proc.descricao || '',
                proc.valor_limite?.toString(),
                proc.nome_empresa,
                validacaoWhitelist.termosBranco
              );
            } catch (err) {
              console.log(`  [${idx + 1}/${todasAsPaginas.length}] ⚠️ Erro OpenAI: ${(err as Error).message}`);
              pipelineLogger.logErro(idEdital, `Erro OpenAI: ${(err as Error).message}`);
              // Fallback para falha interna da API
              validacaoIA = {
                ok: false as const,
                válido: false as const,
                erroTipo: 'unknown' as const,
                mensagem: (err as Error).message,
                modelo: 'unknown'
              };
            }
            
            if (validacaoIA.ok) {
              pipelineLogger.logIA(idEdital, proc.nome, validacaoIA.válido, validacaoIA.tecnologia, validacaoIA.score);
            }

            // ✨ NOVO: Validação final com blacklist
            let textoCombinado = `${proc.nome} ${proc.descricao || ''}`;
            const passarBlacklistObj = validarBlacklist(proc.nome, textoCombinado);
            pipelineLogger.logBlacklist(idEdital, proc.nome, passarBlacklistObj ? 0 : 50, passarBlacklistObj ? 'aprovar' : 'bloquear');
            
            // Rejeita apenas se a classificação por IA foi bem-sucedida E indicou inválido, OU se falhou na blacklist
            const rejeitadoPelaIA = validacaoIA.ok && !validacaoIA.válido;
            if (rejeitadoPelaIA || !passarBlacklistObj) {
              console.log(`  [${idx + 1}/${todasAsPaginas.length}] ❌ Rejeitado (válidoIA=${validacaoIA.ok ? validacaoIA.válido : 'incerto'}, passouBlacklist=${passarBlacklistObj}): ${proc.nome.substring(0, 40)}`);
              pipelineLogger.logResultado(idEdital, proc.nome, 'rejeitado', rejeitadoPelaIA ? 'IA (OpenAI)' : 'Blacklist');
              continue;
            }

            // Montar edital com dados ricos E dados TI (tratando incerteza se OpenAI falhar)
            const edital: Edital = {
              id: idEdital,
              titulo: proc.nome,
              orgao: proc.nome_empresa || 'Prosas',
              valor: proc.valor_limite ? `Até R$ ${proc.valor_limite.toLocaleString('pt-BR')}` : (proc.valor_total_disponivel ? `R$ ${proc.valor_total_disponivel.toLocaleString('pt-BR')}` : 'Sob consulta'),
              valorMax: proc.valor_limite,
              dataLimite: proc.data_limite_inscricao_sem_rascunho || proc.encerramento_das_inscricoes || 'Sem data limite informada',
              status: 'Aberto',
              link: linkExterno || `https://prosas.com.br/editais/${itemId}`,
              descricao: proc.descricao || '', // HTML completo da descrição
              pdfUrl: pdfUrlS3, // S3 PDF com prioridade
              criadoEm: new Date().toISOString(),
              arquivosAnexos: arquivosAnexos.length > 0 ? arquivosAnexos : undefined,
              
              // ✨ NOVOS CAMPOS TI COM INCOGNITA CONTROLADA SE FALHAR
              tecnologiaFoco: validacaoIA.ok ? validacaoIA.tecnologia : undefined,
              tipoFerramenta: validacaoIA.ok ? validacaoIA.tipo : undefined,
              scoreRelevancia: validacaoIA.ok ? validacaoIA.score : 0,
              scoreConfiancaIA: validacaoIA.ok ? validacaoIA.confiança : 0,
              validadoPorIA: validacaoIA.ok,
              palavrasChaveEncontradas: validacaoWhitelist.termosBranco,
              dataValidacaoIA: new Date().toISOString(),
              statusAnalise: validacaoIA.ok ? undefined : 'duvida',
              foraDoEscopo: validacaoIA.ok ? false : null,
              motivosPontuacao: validacaoIA.ok ? undefined : [`Falha temporária na classificação OpenAI: ${validacaoIA.mensagem}`]
            };

            totalEditais.push(edital);
            pipelineLogger.logResultado(idEdital, proc.nome, 'salvo', `Score IA: ${edital.scoreRelevancia}`);
            
            if (validacaoIA.ok) {
              console.log(`  [${idx + 1}/${todasAsPaginas.length}] ✅ VÁLIDO TI [${validacaoIA.tecnologia}]: ${proc.nome.substring(0, 40)}`);
            } else {
              console.log(`  [${idx + 1}/${todasAsPaginas.length}] ❓ INCERTO TI (Falha IA): ${proc.nome.substring(0, 40)}`);
            }

            // Rate limiting: 500ms entre requests de detalhe
            await new Promise(res => setTimeout(res, 500));

        } catch (err: any) {
          const itemId = todasAsPaginas[idx]?.id || 'desconhecido';
          console.warn(`  [${idx + 1}/${todasAsPaginas.length}] ⚠️ Erro ao buscar detalhe do edital ${itemId}: ${err.message}`);
          // Continuar mesmo com erro em um edital específico
        }
      }

      // ✨ NOVO: Log consolidado de estatísticas
      console.log(`\n📊 [PROSAS] ESTATÍSTICAS FINAIS:`);
      console.log(`   Total buscado: ${todasAsPaginas.length}`);
      console.log(`   Válido TI: ${totalEditais.length} (${Math.round((totalEditais.length / todasAsPaginas.length) * 100)}%)`);
      console.log(`   Rejeitado: ${todasAsPaginas.length - totalEditais.length}`);
      
      // Distribuição por tecnologia
      const distribuicao: { [key: string]: number } = {};
      for (const e of totalEditais) {
        const tech = e.tecnologiaFoco || 'Outro';
        distribuicao[tech] = (distribuicao[tech] || 0) + 1;
      }
       console.log(`   Distribuição por tecnologia:`);
       for (const [tech, count] of Object.entries(distribuicao)) {
         console.log(`     - ${tech}: ${count}`);
       }

return totalEditais;
      }
    } catch (e: any) {
      const isUnauthorized = e.response?.status === 401;
      const isTimeout = e.code === 'ECONNABORTED' || e.message?.includes('timeout');
      const isNetworkError = !e.response && e.message?.includes('network');

      console.error(`[PROSAS] ❌ Erro ao processar editais:`, {
        message: e.message,
        status: e.response?.status,
        url: e.config?.url,
        type: e.constructor.name
      });

      let cenario: LogCenarioFalha = 'unknown';
      let acao: LogAcao = 'mark_error';

      if (isUnauthorized) {
        cenario = 'session_expired';
        acao = 'retry';
      } else if (isTimeout) {
        cenario = 'timeout';
        acao = 'retry';
      } else if (isNetworkError) {
        cenario = 'network_error';
        acao = 'retry';
      } else if (e.response?.status >= 500) {
        cenario = 'busca_portal';
        acao = 'human_review';
      }

      await logger.logError(
        `Erro ao processar editais: ${e.message}`,
        cenario,
        acao,
        {
          status: e.response?.status,
          url: e.config?.url,
          type: e.constructor.name,
          partialResults: editais.length
        }
      );

      // Retornar os editais que conseguimos validar antes do erro
      console.log(`[PROSAS] Retornando ${editais.length} editais parcialmente processados`);
    }

    return editais;
  }
