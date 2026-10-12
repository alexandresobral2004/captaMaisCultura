"use client"

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export interface MembroEquipe {
  nome?: string
  funcao?: string
  qualificacao?: string
  dedicacao?: string
}

type Campo = keyof MembroEquipe

const CAMPOS: { chave: Campo; rotulo: string; dica?: string }[] = [
  { chave: 'nome', rotulo: 'Nome' },
  { chave: 'funcao', rotulo: 'Função' },
  { chave: 'qualificacao', rotulo: 'Qualificação' },
  { chave: 'dedicacao', rotulo: 'Dedicação', dica: 'ex: 20h/semana' },
]

interface Props {
  equipe: MembroEquipe[]
  onChange: (equipe: MembroEquipe[]) => void
  incluir: boolean
  onIncluirChange: (incluir: boolean) => void
  /** A lista de membros só aparece depois que o projeto foi gerado */
  mostrarLista: boolean
}

const cardClasse = "bg-white/60 dark:bg-slate-900/60 border-slate-200/60 dark:border-slate-800/60 shadow-sm"

export function EquipeProjeto({ equipe, onChange, incluir, onIncluirChange, mostrarLista }: Props) {
  const atualizar = (indice: number, campo: Campo, valor: string) =>
    onChange(equipe.map((m, i) => (i === indice ? { ...m, [campo]: valor } : m)))

  return (
    <>
      {mostrarLista && (
        <Card className={cardClasse}>
          <CardHeader className="py-3 px-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-50">Equipe do Projeto</CardTitle>
              {equipe.length > 0 && (
                <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-xs w-fit">
                  {equipe.length} {equipe.length === 1 ? 'membro' : 'membros'}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            <div className="space-y-3">
              {equipe.map((membro, i) => (
                <div key={i} className="p-3 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200/50 dark:border-slate-800/50 rounded-lg">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {CAMPOS.map((c) => (
                      <div key={c.chave}>
                        <label htmlFor={`membro-${i}-${c.chave}`} className="text-[10px] font-semibold text-slate-500 uppercase mb-1 block">
                          {c.rotulo}
                        </label>
                        <Input
                          id={`membro-${i}-${c.chave}`}
                          value={membro[c.chave] || ''}
                          className="bg-white dark:bg-slate-950"
                          placeholder={c.dica}
                          onChange={(e) => atualizar(i, c.chave, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {equipe.length === 0 && (
                <p className="text-sm text-slate-500">Nenhum membro ainda. Clique em "Adicionar membro" para começar.</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onChange([...equipe, { nome: '', funcao: '', qualificacao: '', dedicacao: '' }])}
                className="text-xs hover:bg-slate-100"
              >
                + Adicionar membro
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onChange(equipe.slice(0, -1))}
                className="text-xs text-slate-500 hover:text-red-500"
                disabled={equipe.length === 0}
              >
                Remover último
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className={cardClasse}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="incluirEquipe"
              checked={incluir}
              onChange={(e) => onIncluirChange(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="incluirEquipe" className="text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
              Incluir equipe na proposta
            </label>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
