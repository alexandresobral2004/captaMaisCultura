import { NextRequest, NextResponse } from 'next/server';
import { ProjetoService } from '@/lib/database/services/projeto.service';
import PDFDocument from 'pdfkit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

function safeParse(val: any): any {
  if (typeof val !== 'string') return val;
  try {
    let parsed = JSON.parse(val);
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed); } catch { return parsed; }
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
      if (obj[h.key]) {
        md += `### ${h.label}\n\n${obj[h.key].descricao || ''}\n\n`;
        if (obj[h.key].indicadores && Array.isArray(obj[h.key].indicadores)) {
          obj[h.key].indicadores.forEach((ind: any) => {
            const i = ind.indicador ? `**Indicador:** ${ind.indicador}` : '';
            const m = ind.meta ? `**Meta:** ${ind.meta}` : '';
            if (i || m) md += `- ${i}${i && m ? ' — ' : ''}${m}\n`;
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

function gerarTextoProposta(projeto: any, secao?: string): string {
  let md = `# ${projeto.titulo}\n\n`;
  const propostaUsuario = projeto.propostaUsuario || '';

  if (projeto.edital) {
    const edil = projeto.edital as any;
    md += `**Edital:** ${edil.titulo || ''}\n`;
    md += `**Orgão:** ${edil.orgao || ''}\n`;
    if (projeto.valorSolicitado) md += `**Valor Solicitado:** R$ ${Number(projeto.valorSolicitado).toLocaleString('pt-BR')}\n`;
    if (projeto.prazoMeses) md += `**Prazo:** ${projeto.prazoMeses} meses\n`;
    md += '\n---\n\n';
  }

  if (propostaUsuario && (!secao || secao === 'all')) {
    md += `## Proposta do Usuário\n\n${propostaUsuario}\n\n`;
  }

  const secoes = [
    { nome: 'resumoExecutivo', titulo: 'Resumo Executivo' },
    { nome: 'justificativa', titulo: 'Justificativa' },
    { nome: 'objetivos', titulo: 'Objetivos' },
    { nome: 'metodologia', titulo: 'Metodologia' },
    { nome: 'resultadosEsperados', titulo: 'Resultados Esperados' },
    { nome: 'cronograma', titulo: 'Cronograma' },
    { nome: 'orcamentoDetalhado', titulo: 'Orçamento Detalhado' },
  ];

  secoes.forEach(s => {
    const conteudo = (projeto as any)[s.nome];
    if (conteudo && (!secao || secao === s.nome || secao === 'all')) {
      if (s.nome === 'objetivos') md += `## ${s.titulo}\n\n${formatarObjetivosMarkdown(conteudo)}\n\n`;
      else if (s.nome === 'orcamentoDetalhado') md += `## ${s.titulo}\n\n${formatarOrcamentoMarkdown(conteudo)}\n\n`;
      else if (s.nome === 'resultadosEsperados') md += `## ${s.titulo}\n\n${formatarResultadosMarkdown(conteudo)}\n\n`;
      else md += `## ${s.titulo}\n\n${conteudo}\n\n`;
    }
  });

  const equipe = safeParse(projeto.equipe);
  if (equipe && Array.isArray(equipe) && equipe.length > 0 && (!secao || secao === 'all')) {
    md += `## Equipe do Projeto\n\n`;
    equipe.forEach((m: any) => {
      md += `### ${m.nome}\n- **Função:** ${m.funcao || '-'}\n- **Qualificação:** ${m.qualificacao || '-'}\n- **Dedicação:** ${m.dedicacao || '-'}\n\n`;
    });
  }

  const criterios = safeParse(projeto.criteriosAtendidos);
  if (criterios && Array.isArray(criterios) && (!secao || secao === 'all')) {
    md += `## Critérios Atendidos\n\n`;
    criterios.forEach((c: string) => { md += `- ${c}\n`; });
    md += '\n';
  }

  md += `---\n\n*Gerado em ${new Date().toLocaleDateString('pt-BR')} - CaptaMais*\n`;
  return md;
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
    doc.fontSize(26).fillColor('#1a1a1a').text(projeto.titulo, { width: 490, align: 'center' });
    doc.moveDown(1.5);

    if (projeto.edital) {
      const edil = projeto.edital as any;
      doc.fontSize(12).fillColor('#64748b').text(edil.titulo || '', { width: 490, align: 'center' });
      doc.fontSize(11).fillColor('#64748b').text(edil.orgao || '', { width: 490, align: 'center' });
      doc.moveDown(2);
    }

    if (projeto.valorSolicitado) {
      doc.fontSize(16).fillColor('#2c5282')
        .text(`Valor Solicitado: R$ ${Number(projeto.valorSolicitado).toLocaleString('pt-BR')}`, { width: 490, align: 'center' });
    }
    if (projeto.prazoMeses) {
      doc.fontSize(12).fillColor('#475569')
        .text(`Prazo: ${projeto.prazoMeses} meses`, { width: 490, align: 'center' });
    }

    doc.moveDown(3);
    doc.fontSize(10).fillColor('#94a3b8')
      .text(`Gerado em ${new Date().toLocaleDateString('pt-BR')} - CaptaMais`, { width: 490, align: 'center' });

    // === CONTEÚDO ===
    const markdown = gerarTextoProposta(projeto, secao || undefined);
    const lines = markdown.split('\n');
    let capituloAnterior = '';

    for (const line of lines) {
      if (line.startsWith('# ') && line !== `# ${projeto.titulo}`) {
        if (capituloAnterior) {
          doc.moveDown(1);
          doc.fontSize(10).fillColor('#94a3b8').text(`— ${capituloAnterior} —`, { width: 490, align: 'center' });
          doc.moveDown(0.8);
        }
        capituloAnterior = line.replace('# ', '');
        doc.addPage();
        doc.fontSize(18).fillColor('#1a1a1a').text(capituloAnterior, { width: 490, align: 'left' });
        doc.moveDown(0.8);
      } else if (line.startsWith('## ') && !line.startsWith('### ')) {
        if (doc.y > 680) doc.addPage();
        doc.fontSize(13).fillColor('#2c5282').text(line.replace('## ', ''), { width: 490, align: 'left' });
        doc.moveDown(0.4);
      } else if (line.startsWith('### ')) {
        if (doc.y > 680) doc.addPage();
        doc.fontSize(11).fillColor('#2d3748').text(line.replace('### ', ''), { width: 490, align: 'left' });
        doc.moveDown(0.3);
      } else if (line.startsWith('- ')) {
        if (doc.y > 690) doc.addPage();
        let clean = line.replace('- ', '• ');
        clean = clean.replace(/\*\*(.*?)\*\*/g, '$1');
        doc.fontSize(10).fillColor('#1a1a1a').text(clean, { width: 480, align: 'left' });
        doc.moveDown(0.15);
      } else if (line.startsWith('|')) {
        if (line.includes('---') || line.trim() === '|') { continue; }
        if (doc.y > 690) doc.addPage();
        const cols = line.split('|').filter(c => c.trim());
        doc.fontSize(9).fillColor('#1a1a1a').text(cols.map(c => c.trim()).join('   '), { width: 480, align: 'left' });
        doc.moveDown(0.12);
      } else if (line === '---') {
        if (doc.y > 680) doc.addPage();
        doc.moveTo(60, doc.y).lineTo(550, doc.y).strokeColor('#e2e8f0').stroke();
        doc.moveDown(0.5);
      } else if (line.trim() === '') {
        doc.moveDown(0.5);
      } else if (!line.startsWith('#')) {
        if (doc.y > 690) doc.addPage();
        doc.fontSize(10).fillColor('#1a1a1a').text(line, { width: 490, align: 'justify' });
        doc.moveDown(0.25);
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