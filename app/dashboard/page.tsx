import { MainLayout } from "@/components/layout/main-layout"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FileText, Clock, AlertCircle, DollarSign, ArrowRight } from "lucide-react"
import { getAllEditais, parseDateString } from "@/lib/db/editais-store"
import Link from "next/link"

// Força renderização dinâmica pois usa SQLite (módulo nativo Node.js)
export const dynamic = 'force-dynamic';

function formatarValorBRL(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined) return 'Não informado';
  if (typeof valor === 'number') {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  }
  const str = String(valor).trim();
  if (!str) return 'Não informado';
  if (str.includes(',') && (str.includes('R$') || str.includes('.'))) {
    return str;
  }
  const apenasNumeros = str.replace(/[R$\s]/g, '');
  let parseable = apenasNumeros;
  if (apenasNumeros.includes(',') && !apenasNumeros.includes('.')) {
    parseable = apenasNumeros.replace(',', '.');
  }
  const num = parseFloat(parseable);
  if (isNaN(num)) {
    return str;
  }
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
}

export default async function DashboardPage() {
  const editaisReais = await getAllEditais();
  const totalEditais = editaisReais.length;

  const agora = new Date();
  const proximosVencer = editaisReais.filter(edital => {
    const dataFechamento = parseDateString(edital.dataLimite);
    if (!dataFechamento) return false;
    const diffTime = dataFechamento.getTime() - agora.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 10;
  }).length;

  const stats = [
    { title: "Editais Mapeados", value: String(totalEditais), change: `${totalEditais > 0 ? '+' + totalEditais : '0'} ativos`, icon: FileText },
    { title: "Projetos em Análise", value: "5", change: "Aguardando", icon: Clock },
    { title: "Prazos Curtos (≤ 10 dias)", value: String(proximosVencer), change: "Necessita atenção", icon: AlertCircle },
    { title: "Total Captado", value: "R$ 2.4M", change: "+15% ano", icon: DollarSign },
  ];

  const ultimosEditais = editaisReais.slice(0, 5);

  return (
    <MainLayout>
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Visão Geral</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Acompanhe o desempenho de captação da sua instituição em tempo real
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat) => {
            const Icon = stat.icon
            return (
              <Card key={stat.title}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    {stat.title}
                  </CardTitle>
                  <Icon className="w-4 h-4 text-slate-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-50">{stat.value}</div>
                  <p className="text-xs text-slate-500 mt-1">{stat.change}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Editais Table */}
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Últimos Editais Publicados (Abertos)</h3>
            <Link href="/editais">
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                Ver Todos
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left p-3 font-semibold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800">Título</th>
                    <th className="text-left p-3 font-semibold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800">Órgão</th>
                    <th className="text-left p-3 font-semibold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800">Valor Estimado</th>
                    <th className="text-left p-3 font-semibold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800">Data Limite</th>
                    <th className="text-left p-3 font-semibold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {ultimosEditais.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center p-8 text-slate-500">
                        Nenhum edital ativo no banco de dados. Vá em <Link href="/editais" className="text-blue-600 underline">Explorar Editais</Link> para realizar a primeira busca.
                      </td>
                    </tr>
                  ) : (
                    ultimosEditais.map((edital) => (
                      <tr key={edital.id} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-3 font-medium text-slate-900 dark:text-slate-100">{edital.titulo}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-400">{edital.orgao}</td>
                        <td className="p-3 text-slate-900 dark:text-slate-100">{formatarValorBRL(edital.valor)}</td>
                        <td className="p-3 font-medium text-amber-600 dark:text-amber-400">{edital.dataLimite}</td>
                        <td className="p-3"><Badge variant="success">{edital.status}</Badge></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </MainLayout>
  )
}