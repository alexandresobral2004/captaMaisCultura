import { MainLayout } from "@/components/layout/main-layout"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Presentation, BookOpen, ExternalLink } from "lucide-react"

const APRESENTACAO_URL = "https://claude.ai/artifact/5LgiaAT1P2Mc9EhrXv9jwh"
const DOCUMENTO_URL = "https://claude.ai/code/artifact/635ea1ce-8ba8-4910-9f79-d8bf8c096479"

const materiais = [
  {
    href: APRESENTACAO_URL,
    icon: Presentation,
    titulo: "Apresentação: como o Capta+ funciona",
    texto: "Nove slides com o problema, o fluxo de um edital, o funil de filtragem, o papel do Jev e a arquitetura.",
  },
  {
    href: DOCUMENTO_URL,
    icon: BookOpen,
    titulo: "Documento: arquitetura do Capta+",
    texto: "Camadas, engenharia, padrões de projeto, design e usabilidade, tratamento de exceções e próximos passos.",
  },
]

export default function SobrePage() {
  return (
    <MainLayout>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Sobre o sistema</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Materiais que explicam como o Capta+ encontra, filtra e analisa editais. Abrem em uma nova aba e exigem acesso à conta que os compartilhou.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {materiais.map((m) => {
            const Icon = m.icon
            return (
              <a
                key={m.href}
                href={m.href}
                target="_blank"
                rel="noopener noreferrer"
                className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 rounded-lg"
              >
                <Card className="h-full hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Icon className="w-5 h-5 text-blue-600" aria-hidden="true" />
                      <CardTitle>{m.titulo}</CardTitle>
                      <ExternalLink className="w-4 h-4 text-slate-400 ml-auto" aria-label="abre em nova aba" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{m.texto}</p>
                  </CardContent>
                </Card>
              </a>
            )
          })}
        </div>
      </div>
    </MainLayout>
  )
}
