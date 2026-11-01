'use client'

import { useState, useEffect, useCallback } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Coins } from 'lucide-react'
import type { RelatorioCustos } from '@/lib/ai/relatorio-custos'
import { mensagemPeriodoInvalido } from '@/lib/ai/periodo-custos'

const ROTULOS_FASE: Record<string, string> = {
  analise_edital: 'Análise do edital',
  extracao_pdf: 'Extração do PDF',
  redacao_projeto: 'Redação do projeto',
  julgamento_projeto: 'Julgamento do projeto',
  geracao_projeto: 'Geração do projeto',
  classificador_ti: 'Classificador de TI (OpenAI)',
  triagem_jev: 'Triagem (Jev)',
  validacao_documento: 'Validação de documento (Jev)',
}

const dinheiro = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD' })
const numero = new Intl.NumberFormat('pt-BR')

/** Data de hoje no formato do input type="date", em UTC. */
function dataUtc(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function periodoDoMes(): { desde: string; ate: string } {
  const agora = new Date()
  const inicio = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1))
  return { desde: dataUtc(inicio), ate: dataUtc(agora) }
}

export default function CustosIaPage() {
  const [periodo, setPeriodo] = useState(periodoDoMes)
  const [formulario, setFormulario] = useState(periodoDoMes)
  const [relatorio, setRelatorio] = useState<RelatorioCustos | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)

  const carregar = useCallback(async (p: { desde: string; ate: string }) => {
    setCarregando(true)
    setErro(null)
    try {
      const params = new URLSearchParams({
        desde: `${p.desde}T00:00:00.000Z`,
        ate: `${p.ate}T23:59:59.999Z`,
      })
      const resp = await fetch(`/api/v1/custos-ia?${params.toString()}`)
      const json = await resp.json()
      if (!resp.ok || !json.success) throw new Error(json.error ?? 'Falha ao carregar os custos')
      setRelatorio(json.data as RelatorioCustos)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar os custos')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    carregar(periodo)
  }, [periodo, carregar])

  function filtrar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const invalido = mensagemPeriodoInvalido(formulario.desde, formulario.ate)
    if (invalido) {
      setErro(invalido)
      return
    }
    setPeriodo(formulario)
  }

  return (
    <MainLayout>
      <div className="flex flex-col gap-6 min-w-0">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <Coins className="w-6 h-6 text-blue-600" aria-hidden="true" />
            Custos de IA
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Quanto a inteligência artificial custou, por etapa e por edital. Valores em dólar (USD).
          </p>
        </div>

        <form onSubmit={filtrar} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-300">
            Data inicial
            <Input
              type="date"
              value={formulario.desde}
              onChange={(e) => setFormulario({ ...formulario, desde: e.target.value })}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-300">
            Data final
            <Input
              type="date"
              value={formulario.ate}
              onChange={(e) => setFormulario({ ...formulario, ate: e.target.value })}
              required
            />
          </label>
          <Button type="submit" disabled={carregando}>
            {carregando ? 'Carregando…' : 'Filtrar'}
          </Button>
        </form>

        {erro && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {erro}
          </p>
        )}

        {relatorio && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Alerta do mês</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-3">
                <span className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                  {dinheiro.format(relatorio.alerta.totalUsd)}
                </span>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  de {dinheiro.format(relatorio.alerta.limiteUsd)} previstos no mês
                </span>
                {relatorio.alerta.ultrapassou ? (
                  <Badge variant="danger">Limite ultrapassado</Badge>
                ) : (
                  <Badge variant="success">Dentro do limite</Badge>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Total do período</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-700 dark:text-slate-300">
                  <span>Chamadas: {numero.format(relatorio.total.chamadas)}</span>
                  <span>Tokens de entrada: {numero.format(relatorio.total.tokensEntrada)}</span>
                  <span>Tokens de saída: {numero.format(relatorio.total.tokensSaida)}</span>
                  <span className="font-semibold">Custo: {dinheiro.format(relatorio.total.custoUsd)}</span>
                </div>
                {relatorio.total.semPreco > 0 && (
                  <p role="status" className="text-sm text-amber-700 dark:text-amber-400">
                    Há chamadas sem preço cadastrado; o total não inclui elas.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Por etapa</CardTitle>
              </CardHeader>
              <CardContent>
                {relatorio.porFase.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhuma chamada no período.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left text-slate-500 dark:text-slate-400">
                        <tr>
                          <th scope="col" className="py-2 pr-3">Etapa</th>
                          <th scope="col" className="py-2 pr-3 text-right">Chamadas</th>
                          <th scope="col" className="py-2 pr-3 text-right">Tokens entrada</th>
                          <th scope="col" className="py-2 pr-3 text-right">Tokens saída</th>
                          <th scope="col" className="py-2 pr-3 text-right">Custo</th>
                          <th scope="col" className="py-2 text-right">Sem preço</th>
                        </tr>
                      </thead>
                      <tbody>
                        {relatorio.porFase.map((f) => (
                          <tr key={f.origem} className="border-t border-slate-200 dark:border-slate-700">
                            <td className="py-2 pr-3">{ROTULOS_FASE[f.origem] ?? f.origem}</td>
                            <td className="py-2 pr-3 text-right">{numero.format(f.chamadas)}</td>
                            <td className="py-2 pr-3 text-right">{numero.format(f.tokensEntrada)}</td>
                            <td className="py-2 pr-3 text-right">{numero.format(f.tokensSaida)}</td>
                            <td className="py-2 pr-3 text-right">{dinheiro.format(f.custoUsd)}</td>
                            <td className="py-2 text-right">{f.semPreco > 0 ? numero.format(f.semPreco) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Por edital</CardTitle>
              </CardHeader>
              <CardContent>
                {relatorio.porEdital.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhum edital com chamadas no período.</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {relatorio.porEdital.map((e) => (
                      <li key={e.editalId} className="border-t border-slate-200 dark:border-slate-700 pt-3 min-w-0">
                        <div className="flex flex-wrap justify-between gap-2 text-sm">
                          <span className="font-medium break-all">{e.editalId}</span>
                          <span className="text-slate-700 dark:text-slate-300">
                            {numero.format(e.chamadas)} chamadas · {dinheiro.format(e.custoUsd)}
                            {e.semPreco > 0 ? ` · sem preço: ${numero.format(e.semPreco)}` : ''}
                          </span>
                        </div>
                        <ul className="mt-1 flex flex-col gap-0.5 text-xs text-slate-500 dark:text-slate-400">
                          {e.porFase.map((f) => (
                            <li key={f.origem}>
                              {ROTULOS_FASE[f.origem] ?? f.origem}: {numero.format(f.chamadas)} · {dinheiro.format(f.custoUsd)}
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </MainLayout>
  )
}
