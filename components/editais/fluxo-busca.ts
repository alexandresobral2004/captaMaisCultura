import type { ProgressoBusca } from "@/lib/scraper/progresso-busca"

/**
 * Lógica da busca manual na tela, sem React: enfileirar, consultar pelo jobId e reconhecer o fim.
 * O fetch entra por parâmetro para o fluxo ser testável sem navegador.
 */

export type ResultadoEnfileirar =
  | { ok: true; jobId: string }
  | { ok: false; motivo: "em_andamento" | "limite" | "erro"; mensagem: string }

type Buscador = (url: string, init?: RequestInit) => Promise<Response>

/** POST da busca: 202 traz o jobId; 409 é busca já em andamento; 429 é limite semanal. */
export async function enfileirarBuscaManual(fetchFn: Buscador = fetch): Promise<ResultadoEnfileirar> {
  const res = await fetchFn("/api/editais/busca", { method: "POST" })
  const corpo: unknown = await res.json().catch(() => ({}))
  const erro = typeof corpo === "object" && corpo !== null && "error" in corpo && typeof corpo.error === "string" ? corpo.error : null

  if (res.status === 202) {
    const jobId = typeof corpo === "object" && corpo !== null && "jobId" in corpo ? corpo.jobId : null
    if (typeof jobId === "string") return { ok: true, jobId }
    return { ok: false, motivo: "erro", mensagem: "A busca foi aceita, mas não recebeu o identificador para acompanhar." }
  }
  if (res.status === 409) {
    return { ok: false, motivo: "em_andamento", mensagem: "Já existe uma busca em andamento. Aguarde terminar." }
  }
  if (res.status === 429) {
    return { ok: false, motivo: "limite", mensagem: erro ?? "Limite de buscas semanais atingido." }
  }
  return { ok: false, motivo: "erro", mensagem: erro ?? "Não foi possível buscar novos editais." }
}

/** Andamento de uma busca pelo jobId. Null se não der para consultar agora (a tela tenta de novo). */
export async function consultarProgresso(jobId: string, fetchFn: Buscador = fetch): Promise<ProgressoBusca | null> {
  try {
    const res = await fetchFn(`/api/editais/busca/progresso?jobId=${encodeURIComponent(jobId)}`, { cache: "no-store" })
    if (!res.ok) return null
    const corpo: unknown = await res.json()
    return ehProgresso(corpo) ? corpo : null
  } catch {
    return null
  }
}

/** Confere o formato que a tela usa. Resposta fora do formato não vira progresso. */
function ehProgresso(x: unknown): x is ProgressoBusca {
  if (typeof x !== "object" || x === null) return false
  const campos: Record<string, unknown> = { ...x }
  return (
    typeof campos.etapa === "string" &&
    typeof campos.total === "number" &&
    typeof campos.verificados === "number" &&
    typeof campos.saoEditais === "number" &&
    typeof campos.uteis === "number" &&
    typeof campos.paraRevisar === "number" &&
    typeof campos.descartados === "number" &&
    typeof campos.jaExistentes === "number" &&
    (campos.percentual === null || typeof campos.percentual === "number")
  )
}

export function ehFimDaBusca(p: ProgressoBusca): boolean {
  return p.etapa === "concluida" || p.etapa === "erro"
}

export function mensagemFinal(p: ProgressoBusca): string {
  if (p.etapa === "erro") return "A busca terminou com erro. Ela não conta no limite semanal."
  return `Busca concluída: ${p.uteis} úteis, ${p.paraRevisar} para revisar, ${p.jaExistentes} já existiam, ${p.descartados} descartados.`
}
