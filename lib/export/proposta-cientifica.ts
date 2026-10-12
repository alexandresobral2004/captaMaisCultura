// Texto e helpers compartilhados pelas exportações (PDF e DOCX) da proposta científica.
import { Logger } from '@/lib/analise-cientifica/logger';

const logger = new Logger('export/proposta-cientifica');

export interface Pesquisador {
  nome: string;
  cpf: string;
  titulacao: string;
  vinculo: string;
  funcao: string;
  lattes: string;
}

export function cleanJsonString(jsonStr: string): string {
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

export function safeParse(val: any): any {
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

export function htmlToMarkdown(html: string): string {
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

export function stripTitlePrefix(contentMarkdown: string, title: string): string {
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

export function preprocessTextParts(parts: string[]): string[] {
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

export function gerarTextoPropostaCientifica(projeto: any): string {
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

