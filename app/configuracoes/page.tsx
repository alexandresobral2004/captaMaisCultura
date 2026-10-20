import Link from "next/link"
import { MainLayout } from "@/components/layout/main-layout"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Users, Search, Globe, AlertTriangle, Sparkles, Presentation } from "lucide-react"

const secoes = [
  { href: "/usuarios", icon: Users, titulo: "Usuários", texto: "Quem pode entrar no sistema e o que cada pessoa pode fazer." },
  { href: "/configuracoes/filtros", icon: Search, titulo: "O que buscar", texto: "Palavras e regras que definem quais editais interessam para você." },
  { href: "/configuracoes/portais", icon: Globe, titulo: "Onde buscar", texto: "Os sites de onde o sistema traz os editais." },
  { href: "/configuracoes/logs", icon: AlertTriangle, titulo: "Problemas do sistema", texto: "Registro de erros, útil quando algo não funciona e você precisa pedir ajuda." },
  { href: "/configuracoes/prompts", icon: Sparkles, titulo: "Instruções da IA (avançado)", texto: "Como a inteligência artificial analisa os editais. Só mexa se souber o que está fazendo." },
  { href: "/configuracoes/sobre", icon: Presentation, titulo: "Sobre o sistema", texto: "Apresentação e documento que explicam como o Capta+ funciona." },
]

export default function ConfiguracoesPage() {
  return (
    <MainLayout>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Configurações</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Escolha o que deseja ajustar.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {secoes.map((s) => {
            const Icon = s.icon
            return (
              <Link key={s.href} href={s.href} className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 rounded-lg">
                <Card className="h-full hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Icon className="w-5 h-5 text-blue-600" aria-hidden="true" />
                      <CardTitle>{s.titulo}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{s.texto}</p>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>
    </MainLayout>
  )
}
