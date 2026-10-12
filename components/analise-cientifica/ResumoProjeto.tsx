"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface Props {
  completude: number
  nivel: string
  areaTematica: string
}

const cardClasse = "shadow-sm rounded-2xl bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800"

export function ResumoProjeto({ completude, nivel, areaTematica }: Props) {
  const cor = completude >= 70 ? 'bg-green-500' : completude >= 50 ? 'bg-amber-500' : 'bg-violet-500'

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className={`md:col-span-2 ${cardClasse}`}>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-2">
            <span id="rotulo-completude" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Quanto do projeto já está preenchido
            </span>
            <span className="text-sm font-bold text-slate-900 dark:text-slate-50">{completude}%</span>
          </div>
          <div
            role="progressbar"
            aria-labelledby="rotulo-completude"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={completude}
            className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden"
          >
            <div className={`h-full rounded-full transition-all duration-500 ${cor}`} style={{ width: `${completude}%` }} />
          </div>
        </CardContent>
      </Card>

      <Card className={cardClasse}>
        <CardContent className="p-5 flex flex-col justify-center">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 block">Nível da pesquisa</span>
              <span className="text-base font-bold capitalize text-slate-900 dark:text-slate-100">
                {nivel === 'iniciacao' ? 'Iniciação Científica' : nivel}
              </span>
            </div>
            <Badge className="bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300 border-0 rounded-lg">
              {areaTematica}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
