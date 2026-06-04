import axios from 'axios';
import * as cheerio from 'cheerio';
import crypto from 'crypto';
import { Edital, isEditalExcluido } from '../db/editais-store';
import { validarComOpenAI, validarBlacklist, validarWhitelistTI } from './filtros-ti';
import { pipelineLogger } from './pipeline-logger';

const CAPTA_URL = 'https://capta.org.br/fontes-de-financiamento/oportunidades/';

function gerarHashLink(link: string): string {
  const hash = crypto.createHash('sha256').update(link).digest('hex');
  return `capta-${hash.substring(0, 16)}`;
}

function extrairDataLimite(texto: string): string {
  const match = texto.match(/(?:Inscrições?\s*(?:até|encerramento|final):?\s*)?(\d{1,2}\/\d{2}\/\d{4})/i);
  if (match) {
    return match[1];
  }
  const matchBR = texto.match(/(\d{1,2})[\/\-](\d{2})[\/\-](\d{4})/);
  if (matchBR) {
    return `${matchBR[1]}/${matchBR[2]}/${matchBR[3]}`;
  }
  return '';
}

function limparTexto(texto: string): string {
  return texto
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, ' ')
    .trim();
}

interface EditalParseado {
  titulo: string;
  orgao: string;
  descricao: string;
  link: string;
  regiao: string;
  dataLimite: string;
}

function parsearHtml($: cheerio.CheerioAPI): EditalParseado[] {
  const editais: EditalParseado[] = [];
  const seenLinks = new Set<string>();

  $('h3.arquivos').each((_, el) => {
    const $h3 = $(el);
    const $linkAncora = $h3.find('a');
    const titulo = $linkAncora.text().trim();
    const link = $linkAncora.attr('href') || '';

    if (!titulo || !link || seenLinks.has(link)) return;
    seenLinks.add(link);

    const $container = $h3.parent();
    const $proximo = $container.nextUntil('h3.arquivos');

    let orgao = '';
    let descricao = '';
    let regiao = '';
    let dataLimite = '';

    $proximo.each((_, elem) => {
      const texto = $(elem).text().trim();
      const $elem = $(elem);

      if ($elem.is('p')) {
        const strongText = $elem.find('strong').first().text().trim();

        if (strongText.includes('Região') || texto.toLowerCase().includes('região:')) {
          regiao = texto.replace(/Região:\s*/i, '').trim();
        } else if (texto.match(/inscrições?\s*(até|encerramento|final)/i) || texto.match(/inscrições?\s*\d/i)) {
          const dataExtraida = extrairDataLimite(texto);
          if (dataExtraida) dataLimite = dataExtraida;
          descricao += ' ' + texto;
        } else if (strongText && !strongText.includes('Edital') && !strongText.includes('Inscrições')) {
          orgao = strongText;
          descricao += ' ' + texto;
        } else if (texto.length > 50) {
          descricao += ' ' + texto;
        }
      }
    });

    if (!titulo || titulo.length < 5) return;

    editais.push({
      titulo: limparTexto(titulo),
      orgao: orgao || 'Capta/ISPN',
      descricao: limparTexto(descricao).substring(0, 1000),
      link,
      regiao,
      dataLimite,
    });
  });

  return editais;
}

export async function buscarEditaisCapta(): Promise<Edital[]> {
  const editaisValidados: Edital[] = [];
  const agora = new Date();

  try {
    console.log('\n🌐 [CAPTA] Iniciando busca de editais...');
    console.log(`   🔍 URL: ${CAPTA_URL}`);

    const response = await axios.get(CAPTA_URL, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
        'Referer': 'https://capta.org.br/',
      }
    });

    if (response.status !== 200) {
      console.warn(`⚠️ [CAPTA] Resposta não OK: ${response.status}`);
      pipelineLogger.logErro('capta', `Resposta não OK: ${response.status}`);
      return [];
    }

    console.log(`   ✅ Página carregada (${response.data.length} bytes)`);

    const $ = cheerio.load(response.data);
    const editaisParseados = parsearHtml($);

    console.log(`   📊 ${editaisParseados.length} editais encontrados no HTML`);
    pipelineLogger.logBusca(`CAPTA: ${editaisParseados.length} editais encontrados no HTML`);

    if (editaisParseados.length === 0) {
      console.warn('⚠️ [CAPTA] Nenhum edital encontrado na página');
      return [];
    }

    let rejeitados = 0;

    for (const item of editaisParseados) {
      if (!item.dataLimite) continue;

      const idEdital = gerarHashLink(item.link);

      // Verificar se o edital já está inativo/excluído no banco de dados
      if (await isEditalExcluido(idEdital, item.link)) {
        console.log(`   ⏭️ [CAPTA] Edital [${idEdital}] já está excluído no banco de dados. Pulando.`);
        continue;
      }

      try {
        const validacaoWhitelist = validarWhitelistTI(item.titulo, item.descricao);

        if (!validacaoWhitelist.válido) {
          console.log(`   ⏭️ [${idEdital}] Rejeitado por whitelist: ${item.titulo.substring(0, 40)}...`);
          pipelineLogger.logWhitelist(idEdital, item.titulo, false, validacaoWhitelist.confidence || 'baixa', validacaoWhitelist.termosBranco || []);
          pipelineLogger.logResultado(idEdital, item.titulo, 'rejeitado', 'Whitelist');
          rejeitados++;
          continue;
        }
        
        pipelineLogger.logWhitelist(idEdital, item.titulo, true, validacaoWhitelist.confidence || 'alta', validacaoWhitelist.termosBranco || []);

        let validacaoIA;
        try {
          validacaoIA = await validarComOpenAI(
            item.titulo,
            item.descricao,
            undefined,
            'Capta/ISPN',
            validacaoWhitelist.termosBranco
          );
        } catch (err) {
          console.warn(`   ⚠️ Erro OpenAI: ${(err as Error).message}`);
          validacaoIA = {
            ok: false as const,
            válido: false as const,
            erroTipo: 'unknown' as const,
            mensagem: (err as Error).message,
            modelo: 'unknown'
          };
          pipelineLogger.logErro(idEdital, `Erro OpenAI: ${(err as Error).message}`);
        }
        
        if (validacaoIA.ok) {
          pipelineLogger.logIA(idEdital, item.titulo, validacaoIA.válido, validacaoIA.tecnologia, validacaoIA.score);
        }

        const passouBlacklist = validarBlacklist(item.titulo, item.descricao);
        // Note: validarBlacklist returns boolean only in this old version. 
        // We'll mock a simple log for it if we don't have the full object here.
        pipelineLogger.logBlacklist(idEdital, item.titulo, passouBlacklist ? 0 : 50, passouBlacklist ? 'aprovar' : 'bloquear');

        const rejeitadoPelaIA = validacaoIA.ok && !validacaoIA.válido;
        if (rejeitadoPelaIA || !passouBlacklist) {
          console.log(`   ⏭️ [${idEdital}] Rejeitado por IA/blacklist: ${item.titulo.substring(0, 40)}...`);
          pipelineLogger.logResultado(idEdital, item.titulo, 'rejeitado', rejeitadoPelaIA ? 'IA (OpenAI)' : 'Blacklist');
          rejeitados++;
          continue;
        }

        const dataLimiteFormatada = item.dataLimite || 'A consultar';
        const valorMatch = item.descricao.match(/R\$\s*([\d.,]+)/);
        const valor = valorMatch ? `R$ ${valorMatch[1]}` : 'A consultar';

        const edital: Edital = {
          id: idEdital,
          titulo: item.titulo,
          orgao: item.orgao,
          valor,
          dataLimite: dataLimiteFormatada,
          status: 'Aberto',
          link: item.link,
          descricao: item.descricao.substring(0, 500),
          criadoEm: agora.toISOString(),

          tecnologiaFoco: validacaoIA.ok ? validacaoIA.tecnologia : undefined,
          tipoFerramenta: validacaoIA.ok ? validacaoIA.tipo : undefined,
          scoreRelevancia: validacaoIA.ok ? validacaoIA.score : 0,
          scoreConfiancaIA: validacaoIA.ok ? validacaoIA.confiança : 0,
          validadoPorIA: validacaoIA.ok,
          palavrasChaveEncontradas: validacaoWhitelist.termosBranco,
          dataValidacaoIA: agora.toISOString(),
          statusAnalise: validacaoIA.ok ? undefined : 'duvida',
          foraDoEscopo: validacaoIA.ok ? false : null,
          motivosPontuacao: validacaoIA.ok ? undefined : [
            validacaoIA.erroTipo === 'timeout'
              ? `Falha temporária na classificação OpenAI: ${validacaoIA.mensagem}`
              : validacaoIA.erroTipo === 'rate_limit'
              ? `Rate limit da OpenAI: ${validacaoIA.mensagem}`
              : validacaoIA.erroTipo === 'auth'
              ? `Erro de autenticação da OpenAI: ${validacaoIA.mensagem}`
              : validacaoIA.erroTipo === 'parse'
              ? `Resposta inválida da OpenAI: ${validacaoIA.mensagem}`
              : `Falha temporária na classificação OpenAI: ${validacaoIA.mensagem}`
          ],

          areasTematicas: item.regiao ? [item.regiao] : undefined,
          abrangencia: item.regiao || 'Nacional',
        };

        editaisValidados.push(edital);
        console.log(`   ✅ [${editaisValidados.length}] ${item.titulo.substring(0, 50)}`);
        pipelineLogger.logResultado(idEdital, item.titulo, 'salvo', `Score IA: ${edital.scoreRelevancia}`);

      } catch (err) {
        console.warn(`   ⚠️ Erro ao processar ${item.link}:`, (err as Error).message);
        pipelineLogger.logErro(idEdital, (err as Error).message);
        pipelineLogger.logResultado(idEdital, item.titulo, 'erro', 'Erro de processamento');
        rejeitados++;
      }

      await new Promise(res => setTimeout(res, 400));
    }

    console.log(`\n📊 [CAPTA] Resultado: ${editaisValidados.length} válidos, ${rejeitados} rejeitados`);
    return editaisValidados;

  } catch (error) {
    const mensagem = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️ [CAPTA] Erro ao buscar editais: ${mensagem}`);
    return [];
  }
}