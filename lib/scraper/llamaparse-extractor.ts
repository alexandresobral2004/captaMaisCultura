import LlamaCloud from '@llamaindex/llama-cloud';
import fs from 'fs';
import os from 'os';
import path from 'path';

const LLAMA_CLOUD_API_KEY = process.env.LLAMA_CLOUD_API_KEY;

/**
 * Extrai texto de um PDF usando LlamaParse (Markdown com tabelas preservadas).
 * Suporta Buffer ou caminho de arquivo local.
 *
 * @param input - Buffer do PDF ou string com caminho do arquivo
 * @returns Texto em formato Markdown
 * @throws Se a API key não estiver configurada ou a extração falhar
 */
export async function extrairTextoLlamaParse(
  input: Buffer | string
): Promise<string> {
  if (!LLAMA_CLOUD_API_KEY) {
    throw new Error('LLAMA_CLOUD_API_KEY não configurada');
  }

  const client = new LlamaCloud({ apiKey: LLAMA_CLOUD_API_KEY });

  let tempFilePath: string | null = null;
  let fileStream: fs.ReadStream;

  try {
    if (typeof input === 'string') {
      // É um caminho de arquivo
      fileStream = fs.createReadStream(input);
    } else {
      // É um Buffer - salvar em arquivo temporário
      tempFilePath = path.join(os.tmpdir(), `llamaparse-${Date.now()}.pdf`);
      fs.writeFileSync(tempFilePath, input);
      fileStream = fs.createReadStream(tempFilePath);
    }

    // 1. Upload do PDF
    const file = await client.files.create({
      file: fileStream,
      purpose: 'parse',
    });

    // 2. Parse com tier 'cost_effective' (preserva tabelas em Markdown)
    const result = await client.parsing.parse({
      file_id: file.id,
      tier: 'cost_effective',
      version: 'latest',
      expand: ['markdown'],
    });

    // 3. Extrair markdown de todas as páginas
    const markdown = result.markdown?.pages
      ?.map((page: any) => page.markdown)
      .join('\n\n---\n\n') || '';

    if (!markdown || markdown.trim().length === 0) {
      throw new Error('LlamaParse retornou conteúdo vazio');
    }

    return markdown.trim();
  } finally {
    // Limpar arquivo temporário se foi criado
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }
}
