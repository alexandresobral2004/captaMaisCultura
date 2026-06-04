import { NextRequest, NextResponse } from 'next/server';
import { buscarEditaisPortais } from '@/lib/scraper/fetcher';
import fs from 'fs';
import path from 'path';
import { analisarEditalComIA } from '@/lib/ai/analyzer';
import { calcularPontuacaoEdital } from '@/lib/ai/scoring';
import { analisarBlacklist } from '@/lib/scraper/filtros-ti';
import { baixarELerPDFEdital, OpcoesDownload } from '@/lib/scraper/pdf-downloader';
import { saveEdital, Edital } from '@/lib/db/editais-store';
import { verificarAdmin } from '@/lib/api/auth';

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();
}

function ensureManifest(): Record<string, any> {
  const manifestDir = path.join(process.cwd(), 'data', 'downloads');
  if (!fs.existsSync(manifestDir)) {
    fs.mkdirSync(manifestDir, { recursive: true });
  }

  const manifestPath = path.join(manifestDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    fs.writeFileSync(manifestPath, JSON.stringify({}, null, 2), 'utf-8');
    return {};
  }

  try {
    const raw = fs.readFileSync(manifestPath, 'utf-8');
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    console.warn('⚠️  Erro ao carregar manifest de downloads, recriando arquivo...', error);
    fs.writeFileSync(manifestPath, JSON.stringify({}, null, 2), 'utf-8');
    return {};
  }
}

function updateManifest(nomeArquivo: string, data: Record<string, any>) {
  const manifestDir = path.join(process.cwd(), 'data', 'downloads');
  if (!fs.existsSync(manifestDir)) {
    fs.mkdirSync(manifestDir, { recursive: true });
  }
  const manifestPath = path.join(manifestDir, 'manifest.json');
  const manifest = ensureManifest();
  manifest[nomeArquivo] = data;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
}

export async function POST(request: NextRequest) {
  // Verificar se é admin
  const auth = verificarAdmin(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const tempoInicio = Date.now();
    console.log('🚀 API: Iniciando busca consolidada de editais TI em 4 portais...');
    const novosEditais = await buscarEditaisPortais();
    
    console.log(`\n📊 API: ${novosEditais.length} editais válidos em TI localizados. Iniciando download de PDFs e análise IA...`);
    const editaisAnalisados = [];
    let sucessoCount = 0;
    let erroCount = 0;

    for (const edital of novosEditais) {
      try {
        // ✨ NOVO: Skip se edital está fora do escopo
        if (edital.foraDoEscopo === true) {
          console.log(`⏭️ [${edital.id}] Fora do escopo TI. Pulando.`);
          erroCount++;
          continue;
        }
        // 1. Preparar opções de download com as 3 estratégias
        const opcoesDownload: OpcoesDownload = {
          pdfUrlS3: edital.pdfUrl,           // PDF pré-assinado do S3
          linkExterno: edital.link,          // Link externo do edital
          descricaoHtml: edital.descricao    // Descrição HTML da API
        };

        // 2. Download com fallback automático (S3 > Link > HTML)
        const resultadoExtracao = await baixarELerPDFEdital(
          edital.id,
          opcoesDownload,
          edital.orgao,
          edital.titulo,
          edital.dataLimite
        );

        const pdfEncontrado = resultadoExtracao.fonte !== 'sem_pdf' && !!resultadoExtracao.texto;
        const pdfReal = ['pdf_s3', 'pdf_link'].includes(resultadoExtracao.fonte) ||
          (resultadoExtracao.fonte === 'html_link' && !!resultadoExtracao.pdfUrlEncontrada);

        const pontuacao = await calcularPontuacaoEdital({
          titulo: edital.titulo,
          descricao: edital.descricao,
          url: edital.link,
          orgao: edital.orgao,
          portalOrigem: edital.orgao,
          fonteConteudo: resultadoExtracao.fonte,
          pdfEncontrado,
          pdfReal,
          textoExtraido: resultadoExtracao.texto,
          pdfUrlEncontrada: resultadoExtracao.pdfUrlEncontrada
        });

        // Executar a blacklist de forma robusta e obter o score negativo
        const blacklistResultado = analisarBlacklist(edital.titulo, edital.descricao);
        const scoreFinalCalculado = Math.max(0, pontuacao.scoreFinal - blacklistResultado.scoreNegativo);
        const nivelCalculado = scoreFinalCalculado >= 80 ? 'alto' : scoreFinalCalculado >= 60 ? 'medio' : 'baixo';

        const motivosPontuacaoFinais = [...(pontuacao.motivos || [])];
        if (blacklistResultado.scoreNegativo > 0) {
          motivosPontuacaoFinais.push(...blacklistResultado.motivos);
        }

        // Registrar conflito se houver (whitelist válida e recomendação da blacklist for revisar ou bloquear)
        if (pontuacao.whitelist.válido && (blacklistResultado.recomendacao === 'revisar' || blacklistResultado.recomendacao === 'bloquear')) {
          motivosPontuacaoFinais.push(
            `[CONFLITO] Whitelist casou termos de TI, mas Blacklist penalizou com peso -${blacklistResultado.scoreNegativo} (${blacklistResultado.recomendacao}). Encaminhado para revisão humana.`
          );
        }

        const dataDownload = new Date();
        const dataPrefixo = dataDownload.toISOString().slice(0, 10);
        const orgaoSlug = slugify(edital.orgao || 'orgao');
        const nomeArquivo = `${dataPrefixo}-${orgaoSlug}-${scoreFinalCalculado}.pdf`;
        const caminhoDestinoRelativo = path.join('data', 'downloads', nomeArquivo);
        const caminhoDestinoAbsoluto = path.join(process.cwd(), caminhoDestinoRelativo);

        let caminhoFinalAbsoluto = resultadoExtracao.caminhoArquivo;
        if (pdfEncontrado && fs.existsSync(resultadoExtracao.caminhoArquivo)) {
          if (resultadoExtracao.caminhoArquivo !== caminhoDestinoAbsoluto) {
            try {
              fs.renameSync(resultadoExtracao.caminhoArquivo, caminhoDestinoAbsoluto);
              caminhoFinalAbsoluto = caminhoDestinoAbsoluto;
            } catch (erroRenomear) {
              console.warn(`⚠️  Falha ao renomear PDF do edital ${edital.id}:`, erroRenomear);
            }
          }
        }

        if (fs.existsSync(caminhoDestinoAbsoluto)) {
          caminhoFinalAbsoluto = caminhoDestinoAbsoluto;
        }

        const relativoCalculado = caminhoFinalAbsoluto.startsWith(process.cwd())
          ? path.relative(process.cwd(), caminhoFinalAbsoluto)
          : '';
        const caminhoFinalRelativo = relativoCalculado && !relativoCalculado.startsWith('..')
          ? relativoCalculado
          : caminhoDestinoRelativo;

        if (fs.existsSync(caminhoFinalAbsoluto)) {
          updateManifest(path.basename(caminhoFinalAbsoluto), {
            id: edital.id,
            titulo: edital.titulo,
            orgao: edital.orgao,
            dataDownload: dataDownload.toISOString(),
            scorePontuacao: scoreFinalCalculado,
            nivelPontuacao: nivelCalculado,
            fonteConteudo: resultadoExtracao.fonte,
            pdfUrlOriginal: resultadoExtracao.pdfUrlEncontrada || edital.link,
            tamanhoBytes: resultadoExtracao.tamanhoBytes || null,
            modoAnalise: pontuacao.modoAnalise
          });
        }

        // ✨ NOVO FLUXO: Salvar com status 'pendente' para análise manual
        // A IA só analisará quando o usuário clicar em "Analisar"
        const editalSalvo = await saveEdital({
          ...edital,
          fonteConteudo: resultadoExtracao.fonte,
          pdfSalvoEm: caminhoFinalRelativo,
          scorePontuacao: scoreFinalCalculado,
          nivelPontuacao: nivelCalculado,
          motivosPontuacao: motivosPontuacaoFinais,
          modoAnaliseIA: 'completo', // Padrão para análise quando solicitado
          hashPontuacao: pontuacao.hashConteudo,
          cacheClassificacaoUsado: pontuacao.cacheUsado,
          statusAnalise: pdfEncontrado ? 'pendente' : 'sem_pdf' // Muda para 'pendente'
        });

        console.log(`✅ [${edital.id}] Salvo com status PENDENTE - aguardando análise manual do usuário`);
        editaisAnalisados.push(editalSalvo);
        sucessoCount++;
      } catch (err) {
        console.error(`❌ Erro ao processar edital [${edital.id}]:`, err);
        edital.statusAnalise = 'erro';
        edital.erroAnalise = (err as Error).message;
        await saveEdital(edital);
        editaisAnalisados.push(edital);
        erroCount++;
      }
    }

    const tempoTotal = ((Date.now() - tempoInicio) / 60000).toFixed(2);
    
    // ✨ NOVO: Estatísticas consolidadas
    const estatisticas = {
      totalEditaisValidos: novosEditais.length,
      processados: sucessoCount,
      comErro: erroCount,
      tempoMinutos: parseFloat(tempoTotal),
      porTecnologia: {} as { [key: string]: number }
    };

    // Contar por tecnologia
    for (const ed of editaisAnalisados) {
      const tech = ed.tecnologiaFoco || 'Outro';
      estatisticas.porTecnologia[tech] = (estatisticas.porTecnologia[tech] || 0) + 1;
    }

    return NextResponse.json({
      success: true,
      mensagem: `✅ Busca consolidada concluída: ${sucessoCount} editais analisados em ${tempoTotal} minutos`,
      estatisticas,
      quantidade: editaisAnalisados.length,
      editais: editaisAnalisados
    });
  } catch (error) {
    console.error('Erro na API de busca de editais:', error);
    return NextResponse.json(
      { error: 'Erro no processo de busca/download/análise: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
