import { NextRequest, NextResponse } from 'next/server';
import { ProjetoService } from '@/lib/database/services/projeto.service';
import PDFDocument from 'pdfkit';

interface RouteParams {
  params: Promise<{ id: string }>;
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

function formatarObjetivosMarkdown(objetivosJson: string): string {
  try {
    const obj = safeParse(objetivosJson);
    let md = '';
    if (obj.geral) md += `### Objetivo Geral\n\n${obj.geral}\n\n`;
    if (obj.especificos && Array.isArray(obj.especificos)) {
      md += `### Objetivos Específicos\n\n`;
      obj.especificos.forEach((oe: any, i: number) => {
        md += `**${oe.cod || `OE${i + 1}`}** - ${oe.descricao || oe}\n\n`;
        if (oe.indicador) md += `- **Indicador:** ${oe.indicador}\n`;
        if (oe.meta) md += `- **Meta:** ${oe.meta}\n`;
        md += '\n';
      });
    }
    return md || objetivosJson;
  } catch {
    return objetivosJson;
  }
}

function formatarOrcamentoMarkdown(orcamentoJson: string): string {
  try {
    const obj = safeParse(orcamentoJson);
    let md = '';
    const cats = ['administracao', 'divulgacao', 'equipe', 'materiais', 'outros'];
    cats.forEach(c => {
      if (obj[c]) {
        const val = obj[c].valor ? `R$ ${Number(obj[c].valor).toLocaleString('pt-BR')}` : '-';
        md += `| ${c.charAt(0).toUpperCase() + c.slice(1)} | ${val} | ${obj[c].justificativa || '-'} |\n`;
      }
    });
    if (obj.total) md += `| **TOTAL** | **R$ ${Number(obj.total).toLocaleString('pt-BR')}** | |\n`;
    return md;
  } catch {
    return orcamentoJson;
  }
}

function formatarResultadosMarkdown(resultadosJson: string): string {
  try {
    const obj = safeParse(resultadosJson);
    let md = '';
    const horizontes = [
      { key: 'curtoPrazo', label: 'Curto Prazo (0-12 meses)' },
      { key: 'medioPrazo', label: 'Médio Prazo (1-3 anos)' },
      { key: 'longoPrazo', label: 'Longo Prazo (3+ anos)' },
    ];
    horizontes.forEach(h => {
      if (obj[h.key] && obj[h.key].descricao) {
        md += `#### ${h.label}\n\n`;
        md += `${obj[h.key].descricao}\n\n`;
        if (obj[h.key].indicadores && Array.isArray(obj[h.key].indicadores)) {
          obj[h.key].indicadores.forEach((ind: any) => {
            if (ind.indicador) md += `- **Indicador:** ${ind.indicador}\n`;
            if (ind.meta) md += `- **Meta:** ${ind.meta}\n`;
          });
          md += '\n';
        }
      }
    });
    return md || resultadosJson;
  } catch {
    return resultadosJson;
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
  md = md.replace(/<tfoot[^>]*>/gi, '');
  md = md.replace(/<\/tfoot>/gi, '');
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

  // Paragraphs and breaks
  md = md.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');
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
  // Clean up any remaining single asterisks that were meant as italic markers
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

    if (cleanLine === cleanTitle || (cleanLine.length > 3 && (cleanLine.includes(cleanTitle) || cleanTitle.includes(cleanLine)))) {
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

function gerarTextoProposta(projeto: any, secaoSelecionada?: string): string {
  let md = `# ${projeto.titulo}\n\n`;

  // Nota: metadados do edital (titulo, orgão, valor, prazo) NÃO são incluídos
  // no corpo do markdown porque já estão na capa do PDF.

  let secoesList: any[] = [];
  if (projeto.secoesDinamicas) {
    try {
      secoesList = typeof projeto.secoesDinamicas === 'string'
        ? JSON.parse(projeto.secoesDinamicas)
        : projeto.secoesDinamicas;
    } catch {
      secoesList = [];
    }
  }

  const printedKeys = new Set<string>();

  if (Array.isArray(secoesList) && secoesList.length > 0) {
    // Ordenar seções pela ordem definida
    secoesList.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

    secoesList.forEach(s => {
      const conteudo = s.conteudo || '';
      if (conteudo && (!secaoSelecionada || secaoSelecionada === s.chave || secaoSelecionada === 'all')) {
        let markdownConteudo = htmlToMarkdown(conteudo);
        markdownConteudo = stripTitlePrefix(markdownConteudo, s.titulo);
        md += `## ${s.titulo}\n\n${markdownConteudo}\n\n`;
        printedKeys.add(s.chave);
      }
    });
  }

  // Resultados Esperados (campo nativo do banco) - apenas se não impresso de forma dinâmica
  if (projeto.resultadosEsperados && !printedKeys.has('resultadosEsperados') && (!secaoSelecionada || secaoSelecionada === 'all')) {
    const resultadosMd = formatarResultadosMarkdown(projeto.resultadosEsperados);
    // Verifica se conseguiu formatar (se retornou algo diferente de JSON bruto ou se tem conteudo formatado)
    if (resultadosMd && (resultadosMd.includes('Curto Prazo') || resultadosMd.includes('Médio Prazo') || resultadosMd.includes('Longo Prazo'))) {
      md += `## Resultados Esperados\n\n${resultadosMd}\n\n`;
    }
  }

  const equipe = safeParse(projeto.equipe);
  if (equipe && Array.isArray(equipe) && equipe.length > 0 && !printedKeys.has('equipe') && (!secaoSelecionada || secaoSelecionada === 'all')) {
    md += `## Equipe do Projeto\n\n`;
    md += `| Membro / Nome | Função | Qualificação | Dedicação |\n`;
    md += `| --- | --- | --- | --- |\n`;
    equipe.forEach((m: any) => {
      md += `| ${m.nome || '-'} | ${m.funcao || '-'} | ${m.qualificacao || '-'} | ${m.dedicacao || '-'} |\n`;
    });
    md += `\n`;
  }

  const criterios = safeParse(projeto.criteriosAtendidos);
  if (criterios && Array.isArray(criterios) && !printedKeys.has('criteriosAtendidos') && (!secaoSelecionada || secaoSelecionada === 'all')) {
    md += `## Critérios Atendidos\n\n`;
    criterios.forEach((c: string) => { md += `- ${c}\n`; });
    md += '\n';
  }

  // Dados do Proponente
  const dadosProponente = projeto.dadosProponente;
  if (dadosProponente && (!secaoSelecionada || secaoSelecionada === 'all')) {
    md += `## Dados do Proponente\n\n`;

    // Tabela de identificação (formato cabeçalho/valor)
    md += `| Campo | Valor |\n`;
    md += `| --- | --- |\n`;
    if (dadosProponente.cnpjCpf) md += `| **CNPJ/CPF** | ${dadosProponente.cnpjCpf} |\n`;
    if (dadosProponente.nomeProponente) md += `| **Proponente** | ${dadosProponente.nomeProponente} |\n`;
    if (dadosProponente.tipoPessoa) md += `| **Tipo de Pessoa** | ${dadosProponente.tipoPessoa === 'fisica' ? 'Pessoa Física' : 'Pessoa Jurídica'} |\n`;
    md += '\n';

    // Endereço
    if (dadosProponente.logradouro || dadosProponente.cidade) {
      md += `| **Logradouro** | ${dadosProponente.logradouro || '-'} |\n`;
      md += `| **Cidade** | ${dadosProponente.cidade || '-'} |\n`;
      md += `| **UF** | ${dadosProponente.uf || '-'} |\n`;
      md += `| **CEP** | ${dadosProponente.cep || '-'} |\n`;
      md += '\n';
    }

    // Telefones
    if (dadosProponente.telefones && dadosProponente.telefones.length > 0) {
      md += `### Telefones\n\n`;
      md += `| Tipo | UF | DDD | Número | Divulgar |\n`;
      md += `| --- | --- | --- | --- | --- |\n`;
      dadosProponente.telefones.forEach((tel: any) => {
        md += `| ${tel.tipo || '-'} | ${tel.uf || '-'} | ${tel.ddd || '-'} | ${tel.numero || '-'} | ${tel.divulgar ? 'Sim' : 'Não'} |\n`;
      });
      md += '\n';
    }

    // E-mails
    if (dadosProponente.emails && dadosProponente.emails.length > 0) {
      md += `### E-mails\n\n`;
      md += `| Tipo | E-mail |\n`;
      md += `| --- | --- |\n`;
      dadosProponente.emails.forEach((email: any) => {
        md += `| ${email.tipo || '-'} | ${email.email || '-'} |\n`;
      });
      md += '\n';
    }

    // Natureza
    if (dadosProponente.natureza || dadosProponente.esfera) {
      md += `| **Natureza** | ${dadosProponente.natureza || '-'} |\n`;
      md += `| **Esfera** | ${dadosProponente.esfera || '-'} |\n`;
      md += `| **Administração** | ${dadosProponente.administracao || '-'} |\n`;
      md += `| **Fins Lucrativos** | ${dadosProponente.finsLucrativos || '-'} |\n`;
      md += '\n';
    }

    // Dirigentes
    if (dadosProponente.dirigentes && dadosProponente.dirigentes.length > 0) {
      md += `### Dirigentes\n\n`;
      md += `| CPF | Nome |\n`;
      md += `| --- | --- |\n`;
      dadosProponente.dirigentes.forEach((dir: any) => {
        md += `| ${dir.cpf || '-'} | ${dir.nome || '-'} |\n`;
      });
      md += '\n';
    }

    // Contexto IA
    if (dadosProponente.historico || dadosProponente.projetosAnteriores || dadosProponente.capacidadeTecnica) {
      md += `### Contexto para IA\n\n`;
      if (dadosProponente.historico) md += `**Histórico:** ${dadosProponente.historico}\n\n`;
      if (dadosProponente.projetosAnteriores) md += `**Projetos Anteriores:** ${dadosProponente.projetosAnteriores}\n\n`;
      if (dadosProponente.capacidadeTecnica) md += `**Capacidade Técnica:** ${dadosProponente.capacidadeTecnica}\n\n`;
    }
  }

  md += `---\n\nGerado em ${new Date().toLocaleDateString('pt-BR')} - CaptaMais\n`;
  return md;
}

function renderTableRow(
  doc: any,
  cols: string[],
  widths: number[],
  xStart: number,
  isHeader = false
) {
  const padding = 6;

  // Clean cols text (remove asterisks, decode html entities, etc)
  const cleanCols = cols.map(c => c.replace(/\*\*/g, '').trim());

  // Calculate heights of all columns
  let maxHeight = 12; // min height
  cleanCols.forEach((colText, idx) => {
    const w = widths[idx] || 100;
    const h = doc.heightOfString(colText, { width: w - 2 * padding });
    if (h > maxHeight) {
      maxHeight = h;
    }
  });

  const rowHeight = maxHeight + 2 * padding;

  // Check page overflow
  if (doc.y + rowHeight > 740) {
    doc.addPage();
  }

  const yStart = doc.y;

  // Draw background for header row
  if (isHeader) {
    doc.save();
    doc.rect(xStart, yStart, widths.reduce((a, b) => a + b, 0), rowHeight)
      .fill('#f1f5f9');
    doc.restore();
  }

  // Draw cell content
  let currentX = xStart;
  cleanCols.forEach((colText, idx) => {
    const w = widths[idx] || 100;

    doc.fillColor(isHeader ? '#1e293b' : '#334155');
    doc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica').fontSize(isHeader ? 9 : 8.5);

    // Draw text inside the cell bounding box
    const align = idx === 1 && cleanCols.length === 3 && colText.startsWith('R$') ? 'right' : 'left';
    doc.text(colText, currentX + padding, yStart + padding, {
      width: w - 2 * padding,
      align: align
    });

    currentX += w;
  });

  // Draw horizontal bottom border
  doc.save();
  doc.moveTo(xStart, yStart + rowHeight)
    .lineTo(xStart + widths.reduce((a, b) => a + b, 0), yStart + rowHeight)
    .strokeColor('#cbd5e1')
    .lineWidth(0.5)
    .stroke();
  doc.restore();

  // Reset fill and font to defaults
  doc.fillColor('#1a1a1a');
  doc.font('Helvetica').fontSize(10);
  doc.x = 60;
  doc.y = yStart + rowHeight;
}

function buildPdf(projeto: any, secao?: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 60, bottom: 60, left: 60, right: 60 },
      info: { Title: projeto.titulo, Author: 'CaptaMais', Subject: 'Proposta de Projeto' },
    });

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // === CAPA ===

    // Posição inicial Y para a capa
    let currentY = 40;

    // Logo na capa (se houver) - no topo
    if (projeto.logoUrl) {
      try {
        const logoData = projeto.logoUrl;
        if (logoData.startsWith('data:image')) {
          const base64Data = logoData.split(',')[1];
          if (base64Data) {
            const imgBuffer = Buffer.from(base64Data, 'base64');
            const logoWidth = 150;
            const logoHeight = 150;
            const centerX = (doc.page.width - logoWidth) / 2;
            doc.image(imgBuffer, centerX, currentY, { width: logoWidth, height: logoHeight });
            currentY += logoHeight + 20;
          }
        } else if (logoData.startsWith('http')) {
          try {
            const logoWidth = 150;
            const logoHeight = 150;
            const centerX = (doc.page.width - logoWidth) / 2;
            doc.image(logoData, centerX, currentY, { width: logoWidth, height: logoHeight });
            currentY += logoHeight + 20;
          } catch (e) {
            console.warn('Não foi possível carregar a logo da URL:', e);
          }
        }
      } catch (e) {
        console.warn('Erro ao processar logo na capa:', e);
      }
    }

    // Título do projeto
    doc.y = currentY;
    doc.fontSize(26).fillColor('#1a1a1a').text(projeto.titulo, { width: 490, align: 'center' });
    currentY = doc.y + 30;

    // Edital
    if (projeto.edital) {
      const edil = projeto.edital as any;
      doc.y = currentY;
      doc.fontSize(12).fillColor('#64748b').text(edil.titulo || '', { width: 490, align: 'center' });
      currentY = doc.y + 5;
      doc.fontSize(11).fillColor('#64748b').text(edil.orgao || '', { width: 490, align: 'center' });
      currentY = doc.y + 20;
    }

    // Dados do Proponente na capa (formato tabela com cabeçalho/valor)
    const dadosProponente = projeto.dadosProponente;
    if (dadosProponente) {
      doc.y = currentY;
      doc.fontSize(11).fillColor('#475569').text('DADOS DO PROPONENTE', { width: 490, align: 'center' });
      currentY = doc.y + 10;

      // Nome do Proponente
      if (dadosProponente.nomeProponente) {
        doc.fontSize(14).fillColor('#1e293b').text(dadosProponente.nomeProponente, { width: 490, align: 'center' });
        currentY = doc.y + 5;
      }

      // CNPJ/CPF
      if (dadosProponente.cnpjCpf) {
        doc.fontSize(10).fillColor('#64748b').text(`CNPJ/CPF: ${dadosProponente.cnpjCpf}`, { width: 490, align: 'center' });
        currentY = doc.y + 5;
      }

      // E-mail
      if (dadosProponente.emails && dadosProponente.emails.length > 0) {
        const emailPrincipal = dadosProponente.emails.find((e: any) => e.tipo === 'Principal') || dadosProponente.emails[0];
        doc.fontSize(10).fillColor('#64748b').text(`E-mail: ${emailPrincipal.email}`, { width: 490, align: 'center' });
        currentY = doc.y + 5;
      }

      // Telefone
      if (dadosProponente.telefones && dadosProponente.telefones.length > 0) {
        const tel = dadosProponente.telefones[0];
        doc.fontSize(10).fillColor('#64748b').text(`Telefone: (${tel.ddd}) ${tel.numero}`, { width: 490, align: 'center' });
        currentY = doc.y + 15;
      }
    }

    // Valor e Prazo
    doc.y = currentY;
    if (projeto.valorSolicitado) {
      doc.fontSize(18).fillColor('#2c5282')
        .text(`Valor Solicitado: R$ ${Number(projeto.valorSolicitado).toLocaleString('pt-BR')}`, { width: 490, align: 'center' });
      currentY = doc.y + 5;
    }
    if (projeto.prazoMeses) {
      doc.fontSize(13).fillColor('#475569')
        .text(`Prazo: ${projeto.prazoMeses} meses`, { width: 490, align: 'center' });
      currentY = doc.y + 10;
    }

    // Data de geração
    doc.y = currentY + 20;
    doc.fontSize(10).fillColor('#94a3b8')
      .text(`Gerado em ${new Date().toLocaleDateString('pt-BR')} - CaptaMais`, { width: 490, align: 'center' });

    // === CONTEÚDO ===
    const markdown = gerarTextoProposta(projeto, secao || undefined);
    // Collapse 3+ consecutive empty lines into 2 to prevent excessive spacing
    const cleanedMarkdown = markdown.replace(/(\n\s*){3,}/g, '\n\n');
    const lines = cleanedMarkdown.split('\n');
    let inTable = false;
    let tableRowIndex = 0;
    let lastLineWasEmpty = false; // Prevent double spacing from consecutive empty lines

    // Add page break after the cover page
    doc.addPage();

    for (const line of lines) {
      // Skip the title line since it's already rendered on the cover page
      if (line.startsWith('# ') && line === `# ${projeto.titulo}`) {
        continue;
      }

      if (line.startsWith('# ') && line !== `# ${projeto.titulo}`) {
        if (inTable) { inTable = false; doc.moveDown(0.5); }
        doc.addPage();
        doc.font('Helvetica-Bold').fontSize(18).fillColor('#1a1a1a').text(line.replace('# ', ''), { width: 490, align: 'left' });
        doc.font('Helvetica').fontSize(10).fillColor('#1a1a1a'); // Reset font
        doc.moveDown(0.8);
        lastLineWasEmpty = false;
      } else if (line.startsWith('## ') && !line.startsWith('### ')) {
        if (inTable) { inTable = false; doc.moveDown(0.5); }
        if (doc.y > 650) doc.addPage();
        const tituloSecao = line.replace('## ', '');
        doc.font('Helvetica-Bold').fontSize(14).fillColor('#2c5282').text(tituloSecao, { width: 490, align: 'left' });
        doc.moveDown(0.2);
        // Draw horizontal line below each section heading
        doc.moveTo(60, doc.y).lineTo(535, doc.y).strokeColor('#2c5282').lineWidth(1).stroke();
        doc.moveDown(0.6);
        // Reset font after heading
        doc.font('Helvetica').fontSize(10).fillColor('#1a1a1a');
        lastLineWasEmpty = false;
      } else if (line.startsWith('### ') && !line.startsWith('#### ')) {
        if (inTable) { inTable = false; doc.moveDown(0.5); }
        if (doc.y > 680) doc.addPage();
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#2d3748').text(line.replace('### ', ''), { width: 490, align: 'left' });
        doc.moveDown(0.3);
        // Reset font after subheading
        doc.font('Helvetica').fontSize(10).fillColor('#1a1a1a');
        lastLineWasEmpty = false;
      } else if (line.startsWith('#### ')) {
        if (inTable) { inTable = false; doc.moveDown(0.5); }
        if (doc.y > 680) doc.addPage();
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#475569').text(line.replace('#### ', ''), { width: 490, align: 'left' });
        doc.moveDown(0.25);
        // Reset font after sub-subheading
        doc.font('Helvetica').fontSize(10).fillColor('#1a1a1a');
        lastLineWasEmpty = false;
      } else if (line.startsWith('- ')) {
        if (inTable) { inTable = false; doc.moveDown(0.5); }
        if (doc.y > 690) doc.addPage();
        let clean = line.replace('- ', '• ');
        // Remove any stray single asterisks (leftover italic markers)
        clean = clean.replace(/(?<!\*)\*(?!\*)/g, '');
        const textOptions = { width: 470, align: 'left' as const };
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

        // Calculate column widths to fit exactly 475 width
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
        // Prevent excessive spacing from consecutive empty lines
        if (!lastLineWasEmpty) {
          doc.moveDown(0.3);
          lastLineWasEmpty = true;
        }
      } else if (!line.startsWith('#')) {
        if (inTable) { inTable = false; doc.moveDown(0.5); }
        if (doc.y > 690) doc.addPage();
        lastLineWasEmpty = false;

        // Render text with support for inline bold syntax (**text**)
        const textOptions = { width: 490, align: 'justify' as const };
        // Remove any stray single asterisks (leftover italic markers)
        const cleanLine = line.replace(/(?<!\*)\*(?!\*)/g, '');
        const parts = cleanLine.split('**');

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
            doc.moveDown(0.25);
          }
        } else {
          doc.font('Helvetica').fontSize(10).fillColor('#1a1a1a').text(cleanLine, textOptions);
          doc.moveDown(0.25);
        }
      }
    }

    doc.end();
  });
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const formato = searchParams.get('formato') || 'pdf';
    const secao = searchParams.get('secao');

    const service = new ProjetoService();
    const projeto = await service.buscarPorId(id);
    if (!projeto) {
      return NextResponse.json({ success: false, error: 'Projeto não encontrado' }, { status: 404 });
    }

    const tituloArquivo = projeto.titulo.replace(/[^a-zA-Z0-9]/g, '_');

    if (formato === 'markdown') {
      const markdown = gerarTextoProposta(projeto, secao || undefined);
      return new NextResponse(markdown, {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': `attachment; filename="${tituloArquivo}.md"`,
        },
      });
    }

    if (formato === 'pdf') {
      const pdfBuffer = await buildPdf(projeto, secao || undefined);
      return new NextResponse(new Uint8Array(pdfBuffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${tituloArquivo}.pdf"`,
          'Content-Length': String(pdfBuffer.length),
        },
      });
    }

    return NextResponse.json({ success: false, error: 'Formato não suportado' }, { status: 400 });
  } catch (error: any) {
    console.error('Erro ao exportar projeto:', error);
    return NextResponse.json({ success: false, error: error.message || 'Erro interno' }, { status: 500 });
  }
}