"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowRight, Check } from "lucide-react"

export default function LandingPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 px-6 py-4 border-b bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center text-primary-foreground font-bold text-sm">
              C+
            </div>
            <span className="text-lg font-bold text-foreground">
              Capta+
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => router.push("/login")}
            >
              Entrar
            </Button>
            <Button onClick={() => router.push("/login")}>
              Começar Agora
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="px-6 py-20 md:py-32 max-w-7xl mx-auto flex flex-col lg:flex-row gap-12 items-center">
          <div className="flex-1 text-center lg:text-left">
            <div className="inline-block px-3 py-1 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-md mb-6 text-sm font-medium text-primary">
              Novidade: IA para Análise de Editais
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight text-foreground mb-6">
              Transforme a busca por recursos em{' '}
              <span className="text-primary">resultados reais</span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-8 leading-relaxed max-w-2xl mx-auto lg:mx-0">
              O Capta+ centraliza, analisa e recomenda os editais ideais para sua instituição pública,
              aumentando suas chances de aprovação.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 mb-8 justify-center lg:justify-start">
              <Button size="lg" onClick={() => router.push("/login")} className="text-base">
                Criar conta gratuita
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button variant="outline" size="lg" className="text-base">
                Ver demonstração
              </Button>
            </div>
            
            <div className="flex items-center justify-center lg:justify-start gap-4">
              <div className="flex -space-x-3">
                {['A', 'B', 'C', 'D'].map((letter) => (
                  <div key={letter} className="w-10 h-10 rounded-full border-2 border-background bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                    {letter}
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                +2.000 instituições cadastradas
              </p>
            </div>
          </div>
          
          <div className="flex-1 w-full max-w-xl lg:max-w-none relative">
            <div className="p-4 bg-card border rounded-2xl shadow-2xl">
              <div className="bg-muted border rounded-xl p-4 min-h-[300px] flex flex-col gap-2">
                {/* Dashboard Preview skeleton */}
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div className="h-16 bg-background/50 rounded-lg"></div>
                  <div className="h-16 bg-background/50 rounded-lg"></div>
                </div>
                <div className="h-32 bg-background/50 rounded-lg"></div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="px-6 py-20 bg-muted/30">
          <div className="max-w-7xl mx-auto text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Tudo o que você precisa para captar mais
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Nossa plataforma combina tecnologia avançada com uma interface intuitiva para simplificar a gestão de editais.
            </p>
          </div>
          
          <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-8">
            {[
              {
                title: 'Busca Inteligente',
                description: 'Algoritmos que varrem diários oficiais e portais de convênios para encontrar oportunidades compatíveis com seu perfil.'
              },
              {
                title: 'Conformidade Garantida',
                description: 'Checklists automáticos e validação de requisitos para garantir que sua instituição atenda a todas as exigências.'
              },
              {
                title: 'Alertas em Tempo Real',
                description: 'Receba notificações instantâneas sobre novos editais, prazos e retificações importantes.'
              }
            ].map((feature, index) => (
              <div key={index} className="p-8 bg-card border rounded-xl shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mb-6">
                  <Check className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Stats Section */}
        <section className="px-6 py-20 border-y bg-background">
          <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-12 text-center">
            {[
              { value: '+15.000', label: 'Editais Monitorados' },
              { value: 'R$ 2.5B', label: 'Recursos Mapeados' },
              { value: '2.300', label: 'Instituições Ativas' },
              { value: '85%', label: 'Taxa de Sucesso' }
            ].map((stat, index) => (
              <div key={index} className="space-y-2">
                <div className="text-4xl md:text-5xl font-bold text-foreground">
                  {stat.value}
                </div>
                <div className="text-muted-foreground font-medium">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="px-6 py-24 bg-slate-900 text-white text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Transformando recursos em realidade
            </h2>
            <p className="text-xl text-slate-300 mb-10">
              Veja como o Capta+ ajuda a viabilizar projetos que impactam diretamente a vida dos cidadãos.
            </p>
            <Button size="lg" onClick={() => router.push("/login")} className="text-base bg-white text-slate-900 hover:bg-slate-100">
              Quero fazer parte dessa transformação
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="px-6 py-12 border-t bg-background">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center text-primary-foreground font-bold text-sm">
              C+
            </div>
            <span className="text-lg font-bold text-foreground">
              Capta+
            </span>
          </div>
          <nav className="flex flex-wrap justify-center gap-6">
            {['Sobre', 'Funcionalidades', 'Preços', 'Suporte'].map((link) => (
              <a
                key={link}
                href="#"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {link}
              </a>
            ))}
          </nav>
          <p className="text-sm text-muted-foreground text-center md:text-right">
            © 2024 Capta Plus Tecnologia.
          </p>
        </div>
      </footer>
    </div>
  )
}
