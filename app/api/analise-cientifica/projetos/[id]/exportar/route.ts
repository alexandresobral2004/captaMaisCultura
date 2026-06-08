import { NextRequest, NextResponse } from 'next/server';
import { projetos } from '@/lib/analise-cientifica/db-mock';
import PDFDocument from 'pdfkit';
import { Logger } from '@/lib/analise-cientifica/logger';

const logger = new Logger('api/exportar');

interface RouteParams {
  params: { id: string };
}

interface Pesquisador {
  nome: string;
  cpf: string;
  titulacao: string;
  vinculo: string;
  funcao: string;
  lattes: string;
}

function cleanJsonString(jsonStr: string): string {
  let inString = false;
  let escaped = false;
  let result = '';

  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];

    if (char === '"' && !escaped) {
      inString = !inString;
    }

    if (char === '\\' && inString) {
      escaped = !escaped;
    } else {
      escaped = false;
    }

    if (inString && (char === '\n' || char === '\r')) {
      result += '\\n';
    } else {
      result += char;
    }
  }
  return result;
}

function safeParse(val: any): any {
  if (typeof val !== 'string') return val;
  try {
    const sanitized = cleanJsonString(val);
    let parsed = JSON.parse(sanitized);
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(cleanJsonString(parsed)); } catch { return parsed; }
    }
    return parsed;
  } catch {
    return val;
  }
}

function htmlToMarkdown(html: string): string {
  if (!html) return '';
  let md = html;

  // Remove newlines and indentation inside table tags to prevent cell splitting
  md = md.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (match) => {
    return match
      .replace(/\r?\n/g, '')
      .replace(/>\s+</g, '><');
  });

  // Replace block elements and lists
  md = md.replace(/<h1>(.*?)<\/h1>/gi, '# $1\n\n');
  md = md.replace(/<h2>(.*?)<\/h2>/gi, '## $1\n\n');
  md = md.replace(/<h3>(.*?)<\/h3>/gi, '### $1\n\n');

  // Table conversions
  md = md.replace(/<table[^>]*>/gi, '\n');
  md = md.replace(/<\/table>/gi, '\n');
  md = md.replace(/<thead[^>]*>/gi, '');
  md = md.replace(/<\/thead>/gi, '');
  md = md.replace(/<tbody[^>]*>/gi, '');
  md = md.replace(/<\/tbody>/gi, '');
  md = md.replace(/<tr[^>]*>/gi, '');
  md = md.replace(/<\/tr>/gi, '|\n');
  md = md.replace(/<th[^>]*>(.*?)<\/th>/gi, '| **$1** ');
  md = md.replace(/<td[^>]*>(.*?)<\/td>/gi, '| $1 ');

  // Underline, Bold, Italic
  md = md.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<b>(.*?)<\/b>/gi, '**$1**');
  md = md.replace(/<em>(.*?)<\/em>/gi, '**$1**');
  md = md.replace(/<i>(.*?)<\/i>/gi, '**$1**');
  md = md.replace(/<u>(.*?)<\/u>/gi, '$1');

  // Lists
  md = md.replace(/<ul[^>]*>/gi, '\n');
  md = md.replace(/<\/ul>/gi, '\n');
  md = md.replace(/<ol[^>]*>/gi, '\n');
  md = md.replace(/<\/ol>/gi, '\n');
  md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');

  // Paragraphs with style attributes (alignment and margin-bottom spacing)
  md = md.replace(/<p([^>]*)>([\s\S]*?)<\/p>/gi, (match, attrs, content) => {
    let align = '';
    let spacing = '';

    // Extract text-align
    const alignMatch = attrs.match(/text-align:\s*(left|center|right|justify)/i);
    if (alignMatch) {
      align = `[align:${alignMatch[1].toLowerCase()}]`;
    }

    // Extract margin-bottom spacing (e.g. margin-bottom: 16px)
    const marginMatch = attrs.match(/margin-bottom:\s*(\d+)px/i);
    if (marginMatch) {
      const px = parseInt(marginMatch[1], 10);
      if (px <= 6) {
        spacing = '[spacing:small]';
      } else if (px <= 12) {
        spacing = '[spacing:normal]';
      } else if (px <= 20) {
        spacing = '[spacing:medium]';
      } else {
        spacing = '[spacing:large]';
      }
    }

    return `${align}${spacing}${content}\n\n`;
  });
  md = md.replace(/<br\s*\/?>/gi, '\n');

  // Remove other HTML tags
  md = md.replace(/<[^>]+>/g, '');

  // Decode basic HTML entities
  md = md.replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Remove single asterisks used for italic (we convert em/i to bold **)
  md = md.replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, '$1');

  return md.trim();
}

function stripTitlePrefix(contentMarkdown: string, title: string): string {
  if (!contentMarkdown || !title) return contentMarkdown;
  const cleanTitle = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const lines = contentMarkdown.split('\n');

  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cleanLine = line.replace(/^[#*\s:>\-]+|[#*\s:\-]+$/g, '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

    const isMatch = cleanLine === cleanTitle || 
      (cleanLine.length > 3 && 
       (cleanTitle.includes(cleanLine) || 
        (cleanLine.includes(cleanTitle) && cleanLine.length <= cleanTitle.length + 5)));

    if (isMatch) {
      lines[i] = '';
      return lines.join('\n').trim();
    }
  }
  return contentMarkdown;
}

function preprocessTextParts(parts: string[]): string[] {
  const newParts = [...parts];
  for (let i = 1; i < newParts.length; i++) {
    const spaceMatch = newParts[i].match(/^(\s+)/);
    if (spaceMatch) {
      const spaces = spaceMatch[1];
      newParts[i] = newParts[i].substring(spaces.length);
      newParts[i - 1] = newParts[i - 1] + spaces;
    }
  }
  return newParts;
}

function gerarTextoPropostaCientifica(projeto: any): string {
  let secoesList: any[] = [];
  if (projeto.secoesDinamicas) {
    try {
      secoesList = typeof projeto.secoesDinamicas === 'string'
        ? JSON.parse(projeto.secoesDinamicas)
        : projeto.secoesDinamicas;
    } catch (err: any) {
      logger.error('Erro ao fazer parse de secoesDinamicas na compilação do texto', 'gerarTextoPropostaCientifica', { error: err.message });
      secoesList = [];
    }
  }

  // Fallback para projetos antigos ou recém-criados sem secoesDinamicas
  if (secoesList.length === 0) {
    const getTitle = (id: string, def: string) => {
      let titulosMap: Record<string, string> = {};
      if (projeto.titulosPersonalizados) {
        try {
          titulosMap = typeof projeto.titulosPersonalizados === 'string'
            ? JSON.parse(projeto.titulosPersonalizados)
            : projeto.titulosPersonalizados;
        } catch {
          titulosMap = {};
        }
      }
      return titulosMap[id] || def;
    };
    secoesList = [
      { id: 'resumo', chave: 'resumo', titulo: getTitle('resumo', 'Resumo Executivo'), conteudo: projeto.resumoExecutivo || '', ordem: 0 },
      { id: 'justificativa', chave: 'justificativa', titulo: getTitle('justificativa', 'Justificativa'), conteudo: projeto.justificativa || '', ordem: 1 },
      { id: 'objetivos', chave: 'objetivos', titulo: getTitle('objetivos', 'Objetivos'), conteudo: '', ordem: 2 },
      { id: 'metodologia', chave: 'metodologia', titulo: getTitle('metodologia', 'Metodologia'), conteudo: projeto.metodologia || '', ordem: 3 },
      { id: 'resultados', chave: 'resultados', titulo: getTitle('resultados', 'Resultados Esperados'), conteudo: projeto.resultadosEsperados || '', ordem: 4 },
      { id: 'referencias', chave: 'referencias', titulo: getTitle('referencias', 'Referências Bibliográficas (ABNT)'), conteudo: projeto.referencias || '', ordem: 5 }
    ];
  }

  // Ordenar de acordo com a ordem configurada
  secoesList.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

  let md = '';

  secoesList.forEach(s => {
    if (s.chave === 'objetivos') {
      let objetivos = projeto.objetivos;
      if (typeof objetivos === 'string') {
        try {
          objetivos = JSON.parse(objetivos);
        } catch {
          objetivos = { geral: objetivos, especificos: [] };
        }
      }
      if (objetivos && (objetivos.geral || (objetivos.especificos && objetivos.especificos.length > 0))) {
        md += `## ${s.titulo}\n\n`;
        if (objetivos.geral) {
          let rawGeral = htmlToMarkdown(objetivos.geral);
          md += `### Objetivo Geral\n\n${rawGeral}\n\n`;
        }
        if (objetivos.especificos && Array.isArray(objetivos.especificos) && objetivos.especificos.length > 0) {
          md += `### Objetivos Específicos\n\n`;
          objetivos.especificos.forEach((oe: any, i: number) => {
            const desc = htmlToMarkdown(oe.descricao);
            md += `**${oe.cod || `OE${i + 1}`}** - ${desc}\n\n`;
            if (oe.indicador) md += `- **Indicador:** ${oe.indicador}\n`;
            if (oe.meta) md += `- **Meta:** ${oe.meta}\n`;
            md += '\n';
          });
        }
      }
    } else {
      if (s.conteudo) {
        let raw = htmlToMarkdown(s.conteudo);
        raw = stripTitlePrefix(raw, s.titulo);
        md += `## ${s.titulo}\n\n${raw}\n\n`;
      }
    }
  });

  return md.trim();
}

function renderTableRow(
  doc: any,
  cols: string[],
  widths: number[],
  xStart: number,
  isHeader = false
) {
  const padding = 6;
  const cleanCols = cols.map(c => c.replace(/\*\*/g, '').trim());

  let maxHeight = 12;
  cleanCols.forEach((colText, idx) => {
    const w = widths[idx] || 100;
    const h = doc.heightOfString(colText, { width: w - 2 * padding });
    if (h > maxHeight) {
      maxHeight = h;
    }
  });

  const rowHeight = maxHeight + 2 * padding;

  if (doc.y + rowHeight > 740) {
    doc.addPage();
  }

  const yStart = doc.y;

  if (isHeader) {
    doc.save();
    doc.rect(xStart, yStart, widths.reduce((a, b) => a + b, 0), rowHeight)
      .fill('#f1f5f9');
    doc.restore();
  }

  let currentX = xStart;
  cleanCols.forEach((colText, idx) => {
    const w = widths[idx] || 100;

    doc.fillColor(isHeader ? '#1e293b' : '#334155');
    doc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica').fontSize(isHeader ? 9 : 8.5);

    const align = 'left';
    doc.text(colText, currentX + padding, yStart + padding, {
      width: w - 2 * padding,
      align: align
    });

    currentX += w;
  });

  doc.save();
  doc.moveTo(xStart, yStart + rowHeight)
    .lineTo(xStart + widths.reduce((a, b) => a + b, 0), yStart + rowHeight)
    .strokeColor('#cbd5e1')
    .lineWidth(0.5)
    .stroke();
  doc.restore();

  doc.fillColor('#1a1a1a');
  doc.font('Helvetica').fontSize(10);
  doc.x = 60;
  doc.y = yStart + rowHeight;
}

function buildPdf(projeto: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      logger.info('[buildPdf] Iniciando renderização do PDF no PDFKit', 'buildPdf', { id: projeto.id });
      
      let proponentes: Pesquisador[] = [];
      if (projeto.pesquisadoresProponentes) {
        try {
          proponentes = typeof projeto.pesquisadoresProponentes === 'string'
            ? JSON.parse(projeto.pesquisadoresProponentes)
            : projeto.pesquisadoresProponentes;
        } catch (err: any) {
          logger.error('[buildPdf] Falha no parse de pesquisadoresProponentes', 'buildPdf', { error: err.message });
          proponentes = [];
        }
      }
      const nomesProponentes = proponentes.map(p => p.nome).join(', ') || 'Proponente não informado';

      const chunks: Buffer[] = [];
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 60, bottom: 60, left: 60, right: 60 },
        info: { Title: projeto.titulo, Author: nomesProponentes, Subject: 'Proposta de Projeto Científico' },
      });

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => {
        logger.info('[buildPdf] Conversão do stream concluída com sucesso', 'buildPdf');
        resolve(Buffer.concat(chunks));
      });
      doc.on('error', (err) => {
        logger.error('[buildPdf] Erro no stream do PDFKit', 'buildPdf', { error: err.message });
        reject(err);
      });

      // === CAPA ===
      logger.info('[buildPdf] Renderizando capa do projeto científico', 'buildPdf');
      let currentY = 80;

      // Título do projeto
      doc.y = currentY;
      doc.font('Helvetica-Bold').fontSize(24).fillColor('#1e1b4b').text(projeto.titulo.toUpperCase(), { width: 475, align: 'center' });
      currentY = doc.y + 40;

      // Subtítulo
      doc.y = currentY;
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#4f46e5').text('PROPOSTA DE PROJETO CIENTÍFICO', { width: 475, align: 'center' });
      currentY = doc.y + 30;

      // Edital e Órgão de Fomento
      doc.y = currentY;
      doc.font('Helvetica').fontSize(12).fillColor('#475569').text(`Área Temática: ${projeto.areaTematica}`, { width: 475, align: 'center' });
      currentY = doc.y + 5;
      doc.fontSize(11).fillColor('#475569').text(`Nível: ${projeto.nivel === 'iniciacao' ? 'Iniciação Científica' : projeto.nivel.toUpperCase()}`, { width: 475, align: 'center' });
      currentY = doc.y + 40;

      // Pesquisadores Proponentes na Capa (utilizando a variável já declarada no topo)
      if (proponentes.length > 0) {
        doc.y = currentY;
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#1e1b4b').text('EQUIPE DE PROPONENTES', { width: 475, align: 'center' });
        currentY = doc.y + 15;

        proponentes.forEach((p) => {
          doc.y = currentY;
          doc.font('Helvetica-Bold').fontSize(11).fillColor('#334155').text(p.nome, { width: 475, align: 'center' });
          currentY = doc.y + 3;
          doc.font('Helvetica').fontSize(9).fillColor('#64748b').text(`${p.funcao} • ${p.titulacao} • ${p.vinculo || 'Instituição não informada'}`, { width: 475, align: 'center' });
          currentY = doc.y + 12;
        });
        currentY += 20;
      }

      // Data de geração
      doc.y = 720;
      doc.font('Helvetica').fontSize(9).fillColor('#94a3b8')
        .text(`Gerado em ${new Date().toLocaleDateString('pt-BR')} - Proponente(s): ${nomesProponentes}`, { width: 475, align: 'center' });

      // === CONTEÚDO ===
      logger.info('[buildPdf] Compilando conteúdo das seções', 'buildPdf');
      const markdown = gerarTextoPropostaCientifica(projeto);
      const cleanedMarkdown = markdown.replace(/(\n\s*){3,}/g, '\n\n');
      const lines = cleanedMarkdown.split('\n');
      
      let inTable = false;
      let tableRowIndex = 0;
      let lastLineWasEmpty = false;
      let hasRenderedAnySection = false;

      // Add page break after the cover page
      doc.addPage();

      logger.info(`[buildPdf] Renderizando ${lines.length} linhas de seções e parágrafos`, 'buildPdf');

      for (const line of lines) {
        if (line.startsWith('## ') && !line.startsWith('### ')) {
          if (inTable) { inTable = false; doc.moveDown(0.5); }
          
          // Espaçamento rígido de 3cm (85 pontos) entre seções,
          // exceto para a primeira seção do documento.
          const estimatedHeight = 60;
          if (hasRenderedAnySection) {
            if (doc.y + 85 + estimatedHeight > 740) {
              doc.addPage();
            } else {
              doc.y += 85; // Espaço exato de 3cm
            }
          }
          hasRenderedAnySection = true;

          const tituloSecao = line.replace('## ', '');
          logger.info(`[buildPdf] Renderizando título de seção: "${tituloSecao}"`, 'buildPdf');
          doc.font('Helvetica-Bold').fontSize(14).fillColor('#4f46e5').text(tituloSecao, { width: 475, align: 'left' });
          doc.moveDown(0.2);
          
          // Linha divisória VERMELHA abaixo do título
          doc.save();
          doc.moveTo(60, doc.y)
            .lineTo(535, doc.y)
            .strokeColor('#dc2626') // Vermelho acadêmico / fomento
            .lineWidth(1)
            .stroke();
          doc.restore();
          doc.moveDown(0.6);
          
          doc.font('Helvetica').fontSize(10).fillColor('#1a1a1a');
          lastLineWasEmpty = false;
        } else if (line.startsWith('### ') && !line.startsWith('#### ')) {
          if (inTable) { inTable = false; doc.moveDown(0.5); }
          if (doc.y > 680) doc.addPage();
          doc.font('Helvetica-Bold').fontSize(11).fillColor('#1e1b4b').text(line.replace('### ', ''), { width: 475, align: 'left' });
          doc.moveDown(0.3);
          doc.font('Helvetica').fontSize(10).fillColor('#1a1a1a');
          lastLineWasEmpty = false;
        } else if (line.startsWith('#### ')) {
          if (inTable) { inTable = false; doc.moveDown(0.5); }
          if (doc.y > 680) doc.addPage();
          doc.font('Helvetica-Bold').fontSize(10).fillColor('#475569').text(line.replace('#### ', ''), { width: 475, align: 'left' });
          doc.moveDown(0.25);
          doc.font('Helvetica').fontSize(10).fillColor('#1a1a1a');
          lastLineWasEmpty = false;
        } else if (line.startsWith('- ')) {
          if (inTable) { inTable = false; doc.moveDown(0.5); }
          if (doc.y > 690) doc.addPage();
          let clean = line.replace('- ', '• ');
          clean = clean.replace(/(?<!\*)\*(?!\*)/g, '');
          const textOptions = { width: 455, align: 'left' as const };
          const parts = clean.split('**');

          if (parts.length > 1) {
            const processedParts = preprocessTextParts(parts);
            const hasNonEmpty = processedParts.some(p => p !== '');
            if (hasNonEmpty) {
              for (let i = 0; i < processedParts.length; i++) {
                const part = processedParts[i];
                if (part === '') continue;

                const isPartBold = i % 2 === 1;
                doc.font(isPartBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).fillColor('#1a1a1a');

                let isLastNonEmpty = true;
                for (let j = i + 1; j < processedParts.length; j++) {
                  if (processedParts[j] !== '') {
                    isLastNonEmpty = false;
                    break;
                  }
                }
                doc.text(part, {
                  ...textOptions,
                  continued: !isLastNonEmpty
                });
              }
              doc.moveDown(0.15);
            }
          } else {
            doc.font('Helvetica').fontSize(10).fillColor('#1a1a1a').text(clean, textOptions);
            doc.moveDown(0.15);
          }
          lastLineWasEmpty = false;
        } else if (line.startsWith('|')) {
          if (line.includes('---') || line.trim() === '|') { continue; }

          if (!inTable) {
            inTable = true;
            tableRowIndex = 0;
          }

          const cols = line.split('|').slice(1, -1).map(c => c.trim());
          if (cols.length === 0) continue;

          let widths: number[] = [];
          const totalWidth = 475;
          if (cols.length === 4) {
            widths = [100, 70, 185, 120];
          } else if (cols.length === 3) {
            widths = [130, 100, 245];
          } else if (cols.length === 2) {
            widths = [180, 295];
          } else {
            const w = Math.floor(totalWidth / cols.length);
            widths = Array(cols.length).fill(w);
            const sum = widths.reduce((a, b) => a + b, 0);
            if (sum < totalWidth) {
              widths[widths.length - 1] += (totalWidth - sum);
            }
          }

          renderTableRow(doc, cols, widths, 60, tableRowIndex === 0);
          tableRowIndex++;
          lastLineWasEmpty = false;
        } else if (line === '---') {
          if (inTable) { inTable = false; doc.moveDown(0.5); }
          if (doc.y > 680) doc.addPage();
          doc.moveTo(60, doc.y).lineTo(535, doc.y).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
          doc.moveDown(0.5);
          lastLineWasEmpty = false;
        } else if (line.trim() === '') {
          if (inTable) { inTable = false; doc.moveDown(0.5); }
          if (!lastLineWasEmpty) {
            doc.moveDown(0.3);
            lastLineWasEmpty = true;
          }
        } else {
          if (inTable) { inTable = false; doc.moveDown(0.5); }
          if (doc.y > 690) doc.addPage();
          lastLineWasEmpty = false;

          // Extração do alinhamento a partir do marcador gerado pelo parser HTML
          let alignOption: 'left' | 'center' | 'right' | 'justify' = 'justify';
          let parsedLine = line;

          if (parsedLine.startsWith('[align:')) {
            const alignMatch = parsedLine.match(/^\[align:(left|center|right|justify)\]/);
            if (alignMatch) {
              alignOption = alignMatch[1] as any;
              parsedLine = parsedLine.replace(/^\[align:(left|center|right|justify)\]/, '');
            }
          }

          // Extração do espaçamento de parágrafo
          let moveDownAmount = 0.25;
          if (parsedLine.startsWith('[spacing:')) {
            const spacingMatch = parsedLine.match(/^\[spacing:(small|normal|medium|large)\]/);
            if (spacingMatch) {
              const spacingType = spacingMatch[1];
              if (spacingType === 'small') moveDownAmount = 0.12;
              if (spacingType === 'normal') moveDownAmount = 0.25;
              if (spacingType === 'medium') moveDownAmount = 0.5;
              if (spacingType === 'large') moveDownAmount = 0.85;
              parsedLine = parsedLine.replace(/^\[spacing:(small|normal|medium|large)\]/, '');
            }
          }

          const hasIndent = alignOption === 'left' || alignOption === 'justify';
          const textOptions = { 
            width: 475, 
            align: alignOption,
            indent: hasIndent ? 28.35 : 0
          };
          const cleanLine = parsedLine.replace(/(?<!\*)\*(?!\*)/g, '');
          const parts = cleanLine.split('**');

          if (parts.length > 1) {
            const processedParts = preprocessTextParts(parts);
            const hasNonEmpty = processedParts.some(p => p !== '');
            if (hasNonEmpty) {
              let isFirstTextPart = true;

              for (let i = 0; i < processedParts.length; i++) {
                const part = processedParts[i];
                if (part === '') continue;

                const isPartBold = i % 2 === 1;
                doc.font(isPartBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).fillColor('#1a1a1a');

                let isLastNonEmpty = true;
                for (let j = i + 1; j < processedParts.length; j++) {
                  if (processedParts[j] !== '') {
                    isLastNonEmpty = false;
                    break;
                  }
                }
                doc.text(part, {
                  ...textOptions,
                  continued: !isLastNonEmpty,
                  indent: (isFirstTextPart && hasIndent) ? 28.35 : 0
                });
                isFirstTextPart = false;
              }
              doc.moveDown(moveDownAmount);
            }
          } else {
            doc.font('Helvetica').fontSize(10).fillColor('#1a1a1a').text(cleanLine, textOptions);
            doc.moveDown(moveDownAmount);
          }
        }
      }

      logger.info('[buildPdf] Finalizando escrita e encerrando PDFKit', 'buildPdf');
      doc.end();
    } catch (err: any) {
      logger.error('[buildPdf] Exceção capturada durante a geração do PDFKit', 'buildPdf', { error: err.message, stack: err.stack });
      reject(err);
    }
  });
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = params;
  logger.info(`Iniciando requisição de exportação para PDF do projeto científico`, 'GET', { id });

  try {
    const projeto = projetos.get(id);

    if (!projeto) {
      logger.warn(`Projeto científico não encontrado para exportação`, 'GET', { id });
      return NextResponse.json({ success: false, error: 'Projeto não encontrado' }, { status: 404 });
    }

    logger.info(`Projeto encontrado: "${projeto.titulo}". Iniciando buildPdf.`, 'GET', { id });
    const pdfBuffer = await buildPdf(projeto);
    
    logger.info(`PDF gerado com sucesso para o projeto ${id}. Tamanho: ${pdfBuffer.length} bytes`, 'GET', { id });
    
    const tituloArquivo = projeto.titulo.replace(/[^a-zA-Z0-9]/g, '_');
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${tituloArquivo}.pdf"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (error: any) {
    logger.error(`Erro catastrófico ao exportar PDF do projeto científico ${id}`, 'GET', {
      id,
      error: error.message,
      stack: error.stack
    });
    return NextResponse.json({ success: false, error: error.message || 'Erro interno ao exportar' }, { status: 500 });
  }
}
