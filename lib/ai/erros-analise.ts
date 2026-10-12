export const MENSAGEM_SEM_DOCUMENTO =
  'Não foi possível ler o documento do edital: o link pode estar fora do ar, não ter PDF, ou o PDF ser digitalizado (imagem). Abra o link no navegador e, se tiver o PDF, envie-o pelo botão de enviar PDF.';

/** Traduz erros técnicos da análise para uma frase que o usuário entende. */
export function mensagemErroAnalise(erro: unknown): string {
  const msg = erro instanceof Error ? erro.message : String(erro ?? '');
  if (/OPENAI_API_KEY/i.test(msg)) return 'A chave da OpenAI não está configurada no servidor. Fale com o administrador.';
  if (/rate_limit|429/i.test(msg)) return 'A IA está com muitas consultas no momento. Aguarde alguns minutos e tente de novo.';
  if (/timeout|ETIMEDOUT|ECONNABORTED/i.test(msg)) return 'A consulta demorou demais e foi cancelada. Tente de novo em instantes.';
  if (/ENOTFOUND|ECONNREFUSED|ECONNRESET|certificate|getaddrinfo/i.test(msg)) return 'O site do edital não respondeu (fora do ar ou com problema de segurança). Tente mais tarde ou envie o PDF.';
  if (/sem texto extraível|digitalizado/i.test(msg)) return 'O PDF é uma imagem (digitalizado) e não tem texto para ler. Envie uma versão em texto.';
  if (/401|invalid_api_key|incorrect api key/i.test(msg)) return 'A chave da OpenAI foi recusada. Fale com o administrador.';
  return `Não foi possível analisar este edital (${msg.substring(0, 120)}).`;
}
