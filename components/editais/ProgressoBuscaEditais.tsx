"use client"

import { useEffect, useState } from "react"
import { Sparkles } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import type { ProgressoBusca } from "@/lib/scraper/progresso-busca"
import { consultarProgresso, ehFimDaBusca } from "./fluxo-busca"

/**
 * Janela com a animação e a barra de andamento da busca por novos editais.
 * Consulta o job pelo jobId; ao chegar à etapa final, chama onFinal uma vez.
 */
export function ProgressoBuscaEditais({
  ativo,
  jobId,
  onFinal,
}: {
  ativo: boolean
  jobId: string | null
  onFinal: (progresso: ProgressoBusca) => void
}) {
  const [p, setP] = useState<ProgressoBusca | null>(null)

  useEffect(() => {
    if (!ativo || !jobId) {
      setP(null)
      return
    }
    let parar = false
    const ler = async () => {
      const progresso = await consultarProgresso(jobId)
      if (!progresso || parar) return
      setP(progresso)
      if (ehFimDaBusca(progresso)) {
        parar = true
        clearInterval(timer)
        onFinal(progresso)
      }
    }
    ler()
    const timer = setInterval(ler, 1500)
    return () => {
      parar = true
      clearInterval(timer)
    }
    // onFinal muda a cada render da página; o ciclo de consulta depende só de ativo e do job
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, jobId])

  if (!ativo) return null

  const coletando = !p || p.etapa === "coletando" || p.percentual === null
  const pct = p?.percentual ?? 0

  const itens = p
    ? [
        { rotulo: "Verificados", valor: `${p.verificados} de ${p.total}` },
        { rotulo: "São editais", valor: p.saoEditais },
        { rotulo: "Úteis", valor: p.uteis },
        { rotulo: "Para revisar", valor: p.paraRevisar },
        { rotulo: "Descartados", valor: p.descartados },
        { rotulo: "Já existiam", valor: p.jaExistentes },
      ]
    : []

  return (
    <div role="status" aria-live="polite" className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-2xl max-w-md w-[90%] border border-slate-200 dark:border-slate-800 flex flex-col items-center text-center gap-4">
        <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-950/40">
          <Spinner className="w-10 h-10 text-blue-600 dark:text-blue-400 border-2 border-slate-200 border-t-blue-600" />
          <Sparkles className="absolute w-5 h-5 text-amber-500 animate-pulse" />
        </div>
        <div className="w-full">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Buscando novos editais</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            {coletando ? "Consultando os portais cadastrados..." : p?.atual ? `Verificando: ${p.atual}` : "Verificando os editais encontrados..."}
          </p>
        </div>

        <div className="w-full">
          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span>Andamento da busca</span>
            <span>{coletando ? "Calculando..." : `${pct}%`}</span>
          </div>
          <div
            className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={coletando ? undefined : pct}
          >
            {coletando ? (
              <div className="bg-blue-600 h-full w-1/3 rounded-full animate-loading-bar" />
            ) : (
              <div className="bg-blue-600 h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
            )}
          </div>
        </div>

        {!coletando && (
          <dl className="grid grid-cols-3 gap-2 w-full">
            {itens.map((i) => (
              <div key={i.rotulo} className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-2">
                <dd className="text-base font-semibold text-slate-900 dark:text-slate-50">{i.valor}</dd>
                <dt className="text-xs text-slate-500 dark:text-slate-400">{i.rotulo}</dt>
              </div>
            ))}
          </dl>
        )}
        <p className="text-xs text-slate-400">Pode levar alguns minutos. Não feche esta página.</p>
      </div>
    </div>
  )
}
