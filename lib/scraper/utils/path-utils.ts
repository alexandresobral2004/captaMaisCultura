import path from 'path';

export function extrairRelativePath(caminhoCompleto: string): string {
  const cwd = process.cwd();
  if (caminhoCompleto.startsWith(cwd)) {
    const relative = caminhoCompleto.slice(cwd.length);
    return relative.replace(/^[/\\]/, '');
  }
  const match = caminhoCompleto.match(/data[/\\]downloads[/\\].+$/);
  return match ? match[0].replace(/\\/g, '/') : caminhoCompleto;
}

export function buildPdfRelativePath(editalId: string): string {
  return `downloads/edital-${editalId}.pdf`;
}