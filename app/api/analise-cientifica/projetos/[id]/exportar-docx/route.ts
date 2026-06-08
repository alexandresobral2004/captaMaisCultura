import { NextRequest, NextResponse } from 'next/server';
import { projetos } from '@/lib/analise-cientifica/db-mock';
import { Logger } from '@/lib/analise-cientifica/logger';
import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  HeadingLevel, 
  AlignmentType, 
  Table, 
  TableRow, 
  TableCell, 
  WidthType, 
  BorderStyle,
  PageBreak
} from 'docx';

const logger = new Logger('api/exportar-docx');

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

    const alignMatch = attrs.match(/text-align:\s*(left|center|right|justify)/i);
    if (alignMatch) {
      align = `[align:${alignMatch[1].toLowerCase()}]`;
    }

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

  // Remove single asterisks used for italic
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

async function buildDocx(projeto: any): Promise<Buffer> {
  logger.info('[buildDocx] Iniciando build do DOCX', 'buildDocx', { id: projeto.id });

  let proponentes: Pesquisador[] = [];
  if (projeto.pesquisadoresProponentes) {
    try {
      proponentes = typeof projeto.pesquisadoresProponentes === 'string'
        ? JSON.parse(projeto.pesquisadoresProponentes)
        : projeto.pesquisadoresProponentes;
    } catch (err: any) {
      logger.error('[buildDocx] Falha no parse de pesquisadoresProponentes', 'buildDocx', { error: err.message });
      proponentes = [];
    }
  }
  const nomesProponentes = proponentes.map(p => p.nome).join(', ') || 'Proponente não informado';

  const docChildren: any[] = [];

  // === CAPA ===
  // Título do projeto
  docChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 1800, after: 360 },
      children: [
        new TextRun({
          text: projeto.titulo.toUpperCase(),
          bold: true,
          size: 36, // 18pt
          color: "1E1B4B"
        })
      ]
    })
  );

  // Subtítulo
  docChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 240, after: 480 },
      children: [
        new TextRun({
          text: "PROPOSTA DE PROJETO CIENTÍFICO",
          bold: true,
          size: 22, // 11pt
          color: "4F46E5"
        })
      ]
    })
  );

  // Área Temática e Nível
  docChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 60 },
      children: [
        new TextRun({
          text: `Área Temática: ${projeto.areaTematica}`,
          size: 22, // 11pt
          color: "475569"
        })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 60, after: 1200 },
      children: [
        new TextRun({
          text: `Nível: ${projeto.nivel === 'iniciacao' ? 'Iniciação Científica' : projeto.nivel.toUpperCase()}`,
          size: 20, // 10pt
          color: "475569"
        })
      ]
    })
  );

  // Proponentes
  if (proponentes.length > 0) {
    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 240, after: 240 },
        children: [
          new TextRun({
            text: "EQUIPE DE PROPONENTES",
            bold: true,
            size: 20, // 10pt
            color: "1E1B4B"
          })
        ]
      })
    );

    proponentes.forEach((p) => {
      docChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 120, after: 40 },
          children: [
            new TextRun({
              text: p.nome,
              bold: true,
              size: 22, // 11pt
              color: "334155"
            })
          ]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 180 },
          children: [
            new TextRun({
              text: `${p.funcao} • ${p.titulacao} • ${p.vinculo || 'Instituição não informada'}`,
              size: 18, // 9pt
              color: "64748B"
            })
          ]
        })
      );
    });
  }

  // Data de geração no final da capa
  docChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 1400 },
      children: [
        new TextRun({
          text: `Gerado em ${new Date().toLocaleDateString('pt-BR')} - Proponente(s): ${nomesProponentes}`,
          size: 18, // 9pt
          color: "94A3B8"
        })
      ]
    })
  );

  // Quebra de página após a capa
  docChildren.push(
    new Paragraph({
      children: [new PageBreak()]
    })
  );

  // === CONTEÚDO ===
  const markdown = gerarTextoPropostaCientifica(projeto);
  const cleanedMarkdown = markdown.replace(/(\n\s*){3,}/g, '\n\n');
  const lines = cleanedMarkdown.split('\n');

  let currentTableRows: TableRow[] = [];
  let tableRowIndex = 0;

  for (const line of lines) {
    const isTableLine = line.startsWith('|');

    // Se saiu de uma tabela e tem dados pendentes, renderiza e insere a tabela no documento
    if (!isTableLine && currentTableRows.length > 0) {
      docChildren.push(new Table({
        rows: currentTableRows,
        width: { size: 100, type: WidthType.PERCENTAGE }
      }));
      currentTableRows = [];
      tableRowIndex = 0;
      docChildren.push(new Paragraph({ spacing: { before: 120, after: 120 } }));
    }

    if (line.startsWith('## ') && !line.startsWith('### ')) {
      const tituloSecao = line.replace('## ', '');
      docChildren.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 360, after: 180 },
          border: {
            bottom: {
              style: BorderStyle.SINGLE,
              size: 8, // ~1pt
              color: "DC2626", // Vermelho acadêmico
              space: 4
            }
          },
          children: [
            new TextRun({
              text: tituloSecao,
              bold: true,
              size: 28, // 14pt
              color: "4F46E5"
            })
          ]
        })
      );
    } else if (line.startsWith('### ') && !line.startsWith('#### ')) {
      const subSecao = line.replace('### ', '');
      docChildren.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 240, after: 120 },
          children: [
            new TextRun({
              text: subSecao,
              bold: true,
              size: 22, // 11pt
              color: "1E1B4B"
            })
          ]
        })
      );
    } else if (line.startsWith('#### ')) {
      const subSubSecao = line.replace('#### ', '');
      docChildren.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_4,
          spacing: { before: 180, after: 90 },
          children: [
            new TextRun({
              text: subSubSecao,
              bold: true,
              size: 20, // 10pt
              color: "475569"
            })
          ]
        })
      );
    } else if (line.startsWith('- ')) {
      let clean = line.replace('- ', '• ');
      clean = clean.replace(/(?<!\*)\*(?!\*)/g, '');
      const parts = clean.split('**');

      const runs: TextRun[] = [];
      if (parts.length > 1) {
        const processedParts = preprocessTextParts(parts);
        processedParts.forEach((part, i) => {
          if (part === '') return;
          runs.push(
            new TextRun({
              text: part,
              bold: i % 2 === 1,
              size: 20, // 10pt
              color: "1A1A1A"
            })
          );
        });
      } else {
        runs.push(
          new TextRun({
            text: clean,
            size: 20,
            color: "1A1A1A"
          })
        );
      }

      docChildren.push(
        new Paragraph({
          spacing: { before: 60, after: 60 },
          indent: { left: 360 }, // Recuo de lista
          children: runs
        })
      );
    } else if (isTableLine) {
      if (line.includes('---') || line.trim() === '|') { continue; }

      const cols = line.split('|').slice(1, -1).map(c => c.trim());
      if (cols.length === 0) continue;

      const cells = cols.map(colText => {
        const cleanColText = colText.replace(/\*\*/g, '').trim();
        return new TableCell({
          shading: tableRowIndex === 0 ? { fill: "F1F5F9" } : undefined,
          children: [
            new Paragraph({
              spacing: { before: 100, after: 100 },
              children: [
                new TextRun({
                  text: cleanColText,
                  bold: tableRowIndex === 0,
                  size: tableRowIndex === 0 ? 18 : 17,
                  color: tableRowIndex === 0 ? "1E293B" : "334155"
                })
              ]
            })
          ],
          borders: {
            bottom: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
            top: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
            left: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
            right: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
          }
        });
      });

      currentTableRows.push(new TableRow({ children: cells }));
      tableRowIndex++;
    } else if (line.trim() === '') {
      // Pula linhas em branco para não criar excesso de espaço vertical no Word
      continue;
    } else {
      let alignOption: 'left' | 'center' | 'right' | 'justify' = 'justify';
      let parsedLine = line;

      if (parsedLine.startsWith('[align:')) {
        const alignMatch = parsedLine.match(/^\[align:(left|center|right|justify)\]/);
        if (alignMatch) {
          alignOption = alignMatch[1] as any;
          parsedLine = parsedLine.replace(/^\[align:(left|center|right|justify)\]/, '');
        }
      }

      let spacingType: 'small' | 'normal' | 'medium' | 'large' = 'normal';
      if (parsedLine.startsWith('[spacing:')) {
        const spacingMatch = parsedLine.match(/^\[spacing:(small|normal|medium|large)\]/);
        if (spacingMatch) {
          spacingType = spacingMatch[1] as any;
          parsedLine = parsedLine.replace(/^\[spacing:(small|normal|medium|large)\]/, '');
        }
      }

      let afterSpacing = 120;
      if (spacingType === 'small') afterSpacing = 60;
      if (spacingType === 'normal') afterSpacing = 120;
      if (spacingType === 'medium') afterSpacing = 240;
      if (spacingType === 'large') afterSpacing = 420;

      let alignType: any = AlignmentType.JUSTIFIED;
      if (alignOption === 'left') alignType = AlignmentType.LEFT;
      if (alignOption === 'center') alignType = AlignmentType.CENTER;
      if (alignOption === 'right') alignType = AlignmentType.RIGHT;

      const hasIndent = alignOption === 'left' || alignOption === 'justify';
      const cleanLine = parsedLine.replace(/(?<!\*)\*(?!\*)/g, '');
      const parts = cleanLine.split('**');

      const runs: TextRun[] = [];
      if (parts.length > 1) {
        const processedParts = preprocessTextParts(parts);
        processedParts.forEach((part, i) => {
          if (part === '') return;
          runs.push(
            new TextRun({
              text: part,
              bold: i % 2 === 1,
              size: 20, // 10pt
              color: "1A1A1A"
            })
          );
        });
      } else {
        runs.push(
          new TextRun({
            text: cleanLine,
            size: 20,
            color: "1A1A1A"
          })
        );
      }

      docChildren.push(
        new Paragraph({
          alignment: alignType,
          indent: hasIndent ? { firstLine: 567 } : undefined, // 1cm indent in twips
          spacing: { before: 0, after: afterSpacing },
          children: runs
        })
      );
    }
  }

  // Verifica se restou alguma tabela pendente no final
  if (currentTableRows.length > 0) {
    docChildren.push(new Table({
      rows: currentTableRows,
      width: { size: 100, type: WidthType.PERCENTAGE }
    }));
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1417,    // 2.5cm
              bottom: 1417, // 2.5cm
              left: 1700,   // 3cm
              right: 1700,  // 3cm
            }
          }
        },
        children: docChildren
      }
    ]
  });

  return await Packer.toBuffer(doc);
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = params;
  logger.info(`Iniciando requisição de exportação para DOCX do projeto científico`, 'GET', { id });

  try {
    const projeto = projetos.get(id);

    if (!projeto) {
      logger.warn(`Projeto científico não encontrado para exportação DOCX`, 'GET', { id });
      return NextResponse.json({ success: false, error: 'Projeto não encontrado' }, { status: 404 });
    }

    logger.info(`Projeto encontrado: "${projeto.titulo}". Iniciando buildDocx.`, 'GET', { id });
    const docxBuffer = await buildDocx(projeto);
    
    logger.info(`DOCX gerado com sucesso para o projeto ${id}. Tamanho: ${docxBuffer.length} bytes`, 'GET', { id });
    
    const tituloArquivo = projeto.titulo.replace(/[^a-zA-Z0-9]/g, '_');
    return new NextResponse(new Uint8Array(docxBuffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${tituloArquivo}.docx"`,
        'Content-Length': String(docxBuffer.length),
      },
    });
  } catch (error: any) {
    logger.error(`Erro catastrófico ao exportar DOCX do projeto científico ${id}`, 'GET', {
      id,
      error: error.message,
      stack: error.stack
    });
    return NextResponse.json({ success: false, error: error.message || 'Erro interno ao exportar' }, { status: 500 });
  }
}
