import fs from 'fs';
import path from 'path';
import type { Edital } from '../db/editais-store';
import { calcularPontuacaoEdital } from '../ai/scoring';
import { analisarBlacklist } from '../filtros-ti';
import { baixarELerPDFEdital } from './pdf-downloader';
import { validarDocumentoEdital } from './validacao-documento';
import { registrarDecisao } from './funil';
import { camadaDocumento } from '../triagem/pontuacao';
import { SCORE_ALTO, SCORE_MEDIO } from '../triagem/limiares';

type ResultadoExtracao = Awaited<ReturnType<typeof baixarELerPDFEdital>>;

export interface EditalPreparado {
  /** Campos a mesclar no edital antes de salvar (fonte, PDF, score, motivos, status). */
  campos: Partial<Edital>;
  /** Texto extraído do PDF/HTML; vazio quando não há conteúdo. */
  texto: string;
  /** Há conteúdo suficiente para seguir para a análise por IA. */
  pdfEncontrado: boolean;
  scoreFinal: number;
}

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();
}

const DIR_DOWNLOADS = () => path.join(process.cwd(), 'data', 'downloads');

function lerManifest(manifestPath: string): Record<string, unknown> {
  try {
    const raw = fs.readFileSync(manifestPath, 'utf-8');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function atualizarManifest(nomeArquivo: string, dados: Record<string, unknown>) {
  const dir = DIR_DOWNLOADS();
  fs.mkdirSync(dir, { recursive: true });
  const manifestPath = path.join(dir, 'manifest.json');
  const manifest = lerManifest(manifestPath);
  manifest[nomeArquivo] = dados;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
}

/** Renomeia o PDF baixado para `data-orgao-score.pdf` e devolve o caminho relativo final. */
function organizarArquivo(
  resultado: ResultadoExtracao,
  pdfEncontrado: boolean,
  edital: Edital,
  score: number
): { relativo: string; absoluto: string } {
  const prefixo = new Date().toISOString().slice(0, 10);
  const nomeArquivo = `${prefixo}-${slugify(edital.orgao || 'orgao')}-${score}.pdf`;
  const destinoRelativo = path.join('data', 'downloads', nomeArquivo);
  const destinoAbsoluto = path.join(process.cwd(), destinoRelativo);

  let finalAbsoluto = resultado.caminhoArquivo;
  if (pdfEncontrado && fs.existsSync(resultado.caminhoArquivo) && resultado.caminhoArquivo !== destinoAbsoluto) {
    try {
      fs.renameSync(resultado.caminhoArquivo, destinoAbsoluto);
      finalAbsoluto = destinoAbsoluto;
    } catch (erro) {
      console.warn(`⚠️  Falha ao renomear PDF do edital ${edital.id}:`, erro);
    }
  }
  if (fs.existsSync(destinoAbsoluto)) finalAbsoluto = destinoAbsoluto;

  const relativo = finalAbsoluto.startsWith(process.cwd()) ? path.relative(process.cwd(), finalAbsoluto) : '';
  return {
    absoluto: finalAbsoluto,
    relativo: relativo && !relativo.startsWith('..') ? relativo : destinoRelativo,
  };
}

/**
 * Passo único do scan para um edital já triado: baixa o PDF (S3 > link > HTML),
 * pontua respeitando o eixo e organiza o arquivo. Não salva nem chama a IA;
 * quem chama decide (rota de busca salva como pendente, job semanal segue para a IA).
 */
export async function prepararEdital(edital: Edital): Promise<EditalPreparado> {
  const resultado = await baixarELerPDFEdital(
    edital.id,
    { pdfUrlS3: edital.pdfUrl, linkExterno: edital.link, descricaoHtml: edital.descricao },
    edital.orgao,
    edital.titulo,
    edital.dataLimite
  );

  const pdfEncontrado = resultado.fonte !== 'sem_pdf' && !!resultado.texto;
  let documentoConfirmado = false;
  let emDuvida: string | null = null;
  // A dúvida da triagem (eixo ou relevância) não some só porque o documento é mesmo um edital
  const duvidaDaTriagem = edital.statusAnalise === 'duvida';

  // Antes de pontuar, confere se o texto baixado é de um edital (palavras-chave + decisão do Jev)
  if (pdfEncontrado) {
    const validacao = await validarDocumentoEdital({ titulo: edital.titulo, orgao: edital.orgao, texto: resultado.texto });
    const c4 = camadaDocumento(validacao.grupos);
    registrarDecisao({
      editalId: edital.id,
      titulo: edital.titulo,
      etapa: 'documento',
      resultado: validacao.decisao === 'valido' ? 'passou' : validacao.decisao,
      motivo: `${validacao.motivo} [C4 documento ${c4.pontos > 0 ? '+' : ''}${c4.pontos}: ${c4.achados.join('; ') || 'nada'}]`,
      probabilidade: validacao.probabilidade,
    });
    if (validacao.decisao === 'descartado') {
      try { if (fs.existsSync(resultado.caminhoArquivo)) fs.unlinkSync(resultado.caminhoArquivo); } catch { /* arquivo temporário */ }
      return {
        pdfEncontrado: false,
        scoreFinal: 0,
        texto: '',
        campos: {
          fonteConteudo: resultado.fonte,
          statusAnalise: 'descartado',
          erroAnalise: `Não parece um edital: ${validacao.motivo}.`,
          motivosPontuacao: [`[VALIDAÇÃO] ${validacao.motivo}. Palavras encontradas: ${validacao.termos.join(', ') || 'nenhuma'}`],
        },
      };
    }
    documentoConfirmado = validacao.decisao === 'valido';
    if (validacao.decisao === 'duvida') emDuvida = `${validacao.motivo}. Palavras encontradas: ${validacao.termos.join(', ')}`;
  }
  const pdfReal =
    ['pdf_s3', 'pdf_link'].includes(resultado.fonte) ||
    (resultado.fonte === 'html_link' && !!resultado.pdfUrlEncontrada);
  const eixo = edital.categoriaArea === 'Cultura' || edital.categoriaArea === 'Pesquisa' ? edital.categoriaArea : undefined;

  const pontuacao = await calcularPontuacaoEdital({
    titulo: edital.titulo,
    descricao: edital.descricao,
    url: edital.link,
    orgao: edital.orgao,
    portalOrigem: edital.orgao,
    fonteConteudo: resultado.fonte,
    pdfEncontrado,
    pdfReal,
    documentoConfirmado,
    textoExtraido: resultado.texto,
    pdfUrlEncontrada: resultado.pdfUrlEncontrada,
    eixo,
  });

  // A blacklist de TI só vale para o eixo Pesquisa; em Cultura ela seria um falso positivo.
  const blacklist = eixo === 'Cultura' ? null : analisarBlacklist(edital.titulo, edital.descricao);
  const penalidade = blacklist?.scoreNegativo ?? 0; // informativo: não reduz a nota
  const scoreFinal = pontuacao.scoreFinal;
  const nivel = scoreFinal >= SCORE_ALTO ? 'alto' : scoreFinal >= SCORE_MEDIO ? 'medio' : 'baixo';

  const motivos = [...(pontuacao.motivos || [])];
  if (emDuvida) motivos.unshift(`[VALIDAÇÃO] ${emDuvida}`);
  if (duvidaDaTriagem) motivos.unshift(...(edital.motivosPontuacao ?? []));
  if (blacklist && penalidade > 0) motivos.push(...blacklist.motivos.map(m => `${m} (informativo)`));
  if (blacklist && pontuacao.whitelist.válido && (blacklist.recomendacao === 'revisar' || blacklist.recomendacao === 'bloquear')) {
    motivos.push(
      `[CONFLITO] Whitelist casou termos de TI, mas a blacklist apontou termos suspeitos (${blacklist.recomendacao}). Encaminhado para revisão humana.`
    );
  }

  const arquivo = organizarArquivo(resultado, pdfEncontrado, edital, scoreFinal);
  if (fs.existsSync(arquivo.absoluto)) {
    atualizarManifest(path.basename(arquivo.absoluto), {
      id: edital.id,
      titulo: edital.titulo,
      orgao: edital.orgao,
      dataDownload: new Date().toISOString(),
      scorePontuacao: scoreFinal,
      nivelPontuacao: nivel,
      fonteConteudo: resultado.fonte,
      pdfUrlOriginal: resultado.pdfUrlEncontrada || edital.link,
      tamanhoBytes: resultado.tamanhoBytes || null,
      modoAnalise: pontuacao.modoAnalise,
    });
  }

  return {
    // Em dúvida, o texto fica guardado mas a análise automática espera a revisão de uma pessoa
    pdfEncontrado: pdfEncontrado && !emDuvida && !duvidaDaTriagem,
    scoreFinal,
    texto: resultado.texto || '',
    campos: {
      fonteConteudo: resultado.fonte,
      pdfSalvoEm: arquivo.relativo,
      scorePontuacao: scoreFinal,
      nivelPontuacao: nivel,
      motivosPontuacao: motivos,
      modoAnaliseIA: 'completo',
      statusAnalise: emDuvida || duvidaDaTriagem ? 'duvida' : pdfEncontrado ? 'pendente' : 'sem_pdf',
    },
  };
}
