import fs from 'fs';
import path from 'path';

/** Lista recursivamente os .ts e .tsx de uma pasta, ignorando node_modules. */
export function arquivosTs(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = path.join(dir, entrada.name);
    if (entrada.isDirectory()) return entrada.name === 'node_modules' ? [] : arquivosTs(caminho);
    return /\.(ts|tsx)$/.test(entrada.name) ? [caminho] : [];
  });
}
