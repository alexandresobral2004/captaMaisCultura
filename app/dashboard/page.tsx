import { MainLayout } from "@/components/layout/main-layout"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FileText, Theater, AlertCircle, ArrowRight, Search, FolderOpen } from "lucide-react"
import { getAllEditais, parseDateString } from "@/lib/db/editais-store"
import Link from "next/link"
import { db } from "@/lib/database/db"
import { projetos } from "@/lib/database/schema"
import { count } from "drizzle-orm"

// Força renderização dinâmica pois usa SQLite (módulo nativo Node.js)
export const dynamic = 'force-dynamic';
import { formatarDataBr } from '@/lib/utils/formatar-data';

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

function renderAreaBadge(area: string) {
  const normArea = area || 'Cultura';
  let styles = {
    backgroundColor: '#EEF2F6',
    color: '#475569',
    borderColor: '#CBD5E1',
    emoji: '📁'
  };

  if (normArea === 'Cultura') {
    styles = {
      backgroundColor: '#ECFDF5',
      color: '#047857',
      borderColor: '#A7F3D0',
      emoji: '🎭'
    };
  } else if (normArea === 'Pesquisa') {
    styles = {
      backgroundColor: '#F5F3FF',
      color: '#6D28D9',
      borderColor: '#DDD6FE',
      emoji: '🔬'
    };
  } else if (normArea === 'Esporte') {
    styles = {
      backgroundColor: '#EFF6FF',
      color: '#1D4ED8',
      borderColor: '#BFDBFE',
      emoji: '⚽'
    };
  } else if (normArea === 'Infraestrutura') {
    styles = {
      backgroundColor: '#FFFBEB',
      color: '#B45309',
      borderColor: '#FDE68A',
      emoji: '🚧'
    };
  }

  return (
    <Badge 
      variant="default" 
      style={{
        backgroundColor: styles.backgroundColor,
        color: styles.color,
        borderColor: styles.borderColor,
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem'
      }}
    >
      <span>{styles.emoji}</span>
      <span>{normArea}</span>
    </Badge>
  );
}

export default async function DashboardPage() {
  const editaisReais = await getAllEditais();
  const totalEditais = editaisReais.length;
  const [{ total: totalProjetos }] = db.select({ total: count() }).from(projetos).all();

  const agora = new Date();
  const proximosVencer = editaisReais.filter(edital => {
    const dataFechamento = parseDateString(edital.dataLimite);
    if (!dataFechamento) return false;
    const diffTime = dataFechamento.getTime() - agora.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 10;
  }).length;

  const totalCultura = editaisReais.filter(e => (e.categoriaArea || 'Cultura') === 'Cultura').length;
  const totalPesquisa = editaisReais.filter(e => e.categoriaArea === 'Pesquisa').length;

  const stats = [
    { title: "Editais encontrados", value: String(totalEditais), change: "No total, já salvos no sistema", icon: FileText },
    { title: "Prazo acabando", value: String(proximosVencer), change: "Fecham em até 10 dias", icon: AlertCircle },
    { title: "Projetos criados", value: String(totalProjetos), change: "Projetos culturais no sistema", icon: FolderOpen },
    { title: "Cultura e Pesquisa", value: `${totalCultura} e ${totalPesquisa}`, change: "Editais de cada área", icon: Theater },
  ];

  const passos = [
    { href: "/editais", icon: Search, titulo: "1. Procure editais", texto: "Os editais abertos aparecem na lista de Editais." },
    { href: "/editais", icon: FileText, titulo: "2. Veja os melhores", texto: "A lista mostra primeiro os que mais combinam com você." },
    { href: "/projetos", icon: FolderOpen, titulo: "3. Monte seu projeto", texto: "Escolha um edital e preencha o projeto com ajuda da IA." },
  ];

  const ultimosEditais = editaisReais.slice(0, 5);

  return (
    <MainLayout>
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Início</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Um resumo dos editais encontrados e do que precisa da sua atenção.
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

        {totalEditais === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Primeiros passos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {passos.map((p) => {
                  const Icon = p.icon
                  return (
                    <Link key={p.titulo} href={p.href} className="flex gap-3 p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <Icon className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" aria-hidden="true" />
                      <span>
                        <span className="block font-semibold text-slate-900 dark:text-slate-100">{p.titulo}</span>
                        <span className="block text-sm text-slate-600 dark:text-slate-400">{p.texto}</span>
                      </span>
                    </Link>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Editais Table */}
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Editais abertos mais recentes</h3>
            <Link href="/editais">
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                Ver todos
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th scope="col" className="text-left p-3 font-semibold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800">Nome do edital</th>
                    <th scope="col" className="text-left p-3 font-semibold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800">Quem publicou</th>
                    <th scope="col" className="text-left p-3 font-semibold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800">Valor</th>
                    <th scope="col" className="text-left p-3 font-semibold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800">Prazo final</th>
                    <th scope="col" className="text-left p-3 font-semibold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800">Área</th>
                    <th scope="col" className="text-left p-3 font-semibold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {ultimosEditais.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center p-8 text-slate-500">
                        Ainda não há editais por aqui. Abra a página <Link href="/editais" className="text-blue-600 underline">Editais</Link> para ver as oportunidades.
                      </td>
                    </tr>
                  ) : (
                    ultimosEditais.map((edital) => (
                      <tr key={edital.id} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-3 font-medium text-slate-900 dark:text-slate-100">{edital.titulo}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-400">{edital.orgao}</td>
                        <td className="p-3 text-slate-900 dark:text-slate-100">{formatarValorBRL(edital.valor)}</td>
                        <td className="p-3 font-medium text-amber-600 dark:text-amber-400">{formatarDataBr(edital.dataLimite)}</td>
                        <td className="p-3">{renderAreaBadge(edital.categoriaArea || 'Cultura')}</td>
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