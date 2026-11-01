import { apiKeyConfigurada, obterClienteOpenAI, obterModelo } from '../ai/client';
import { registrarUsoDeResposta, type RefUso } from '../ai/uso-ia';
import { ConferenciaErro } from './conferencia';

/** Julgamento dos critérios pela IA (resposta em JSON). */
export async function julgarComOpenAI(prompt: string, ref: RefUso = {}): Promise<string> {
  if (!apiKeyConfigurada()) throw new ConferenciaErro('Chave da IA não configurada no servidor.', 500);
  const resp = await obterClienteOpenAI().chat.completions.create({
    model: obterModelo('mini'),
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: prompt }],
  });
  void registrarUsoDeResposta({ origem: 'julgamento_projeto', ...ref }, resp, obterModelo('mini'));
  return resp.choices[0]?.message?.content || '{}';
}
