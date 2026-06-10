"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import "../styles/landing.css"

/* ── Inline SVG icons (zero extra deps) ── */
const IconSearch = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
  </svg>
)
const IconBrain = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/>
    <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/>
    <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>
  </svg>
)
const IconFile = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
    <path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>
  </svg>
)
const IconZap = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>
  </svg>
)
const IconShield = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>
  </svg>
)
const IconBell = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
  </svg>
)
const IconCheck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6 9 17l-5-5"/>
  </svg>
)
const IconArrowRight = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
  </svg>
)
const IconChevronRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m9 18 6-6-6-6"/>
  </svg>
)

/* ── Scroll-reveal hook ── */
function useScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("lp-revealed") }),
      { threshold: 0.1, rootMargin: "0px 0px -60px 0px" }
    )
    document.querySelectorAll(".lp-reveal").forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])
}

/* ── Animated counter ── */
function useCounter(target: number, duration = 2200, active = false) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!active) return
    let start: number | null = null
    const tick = (ts: number) => {
      if (!start) start = ts
      const p = Math.min((ts - start) / duration, 1)
      setCount(Math.floor((1 - Math.pow(1 - p, 3)) * target))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target, duration, active])
  return count
}

function StatCard({ value, label, prefix = "", suffix = "" }: {
  value: number; label: string; prefix?: string; suffix?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(false)
  const count = useCounter(value, 2200, active)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setActive(true) },
      { threshold: 0.5 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  // Format large numbers compactly
  const display = value >= 1_000_000_000
    ? (count / 1_000_000_000).toFixed(1)
    : count.toLocaleString("pt-BR")

  return (
    <div ref={ref} className="lp-stat-card">
      <div className="lp-stat-value">{prefix}{display}{suffix}</div>
      <div className="lp-stat-label">{label}</div>
    </div>
  )
}

/* ── Main component ── */
export default function LandingPage() {
  const router = useRouter()
  useScrollReveal()

  // Fix hydration: render year only on client
  const [year, setYear] = useState<number | null>(null)
  useEffect(() => { setYear(new Date().getFullYear()) }, [])

  const features = [
    { icon: <IconSearch />, color: "blue",    title: "Busca Automatizada",    desc: "Monitora em tempo real Prosas, FINEP, CNPq, CAPES e Ministério da Ciência. Nunca perca um edital relevante." },
    { icon: <IconBrain />,  color: "purple",  title: "Análise com IA",        desc: "A IA extrai datas, valores, elegibilidade, documentos exigidos e cria um resumo executivo de cada edital." },
    { icon: <IconFile />,   color: "emerald", title: "Geração de Projetos",   desc: "Com base no perfil da sua instituição, o sistema gera automaticamente a estrutura do seu projeto de captação." },
    { icon: <IconZap />,    color: "amber",   title: "Pipeline Inteligente",  desc: "3 camadas: whitelist, IA classificadora e análise completa garantem precisão sem falsos positivos." },
    { icon: <IconShield />, color: "rose",    title: "Conformidade Garantida",desc: "Checklists automáticos validam se sua instituição atende todos os requisitos antes de você investir tempo." },
    { icon: <IconBell />,   color: "cyan",    title: "Alertas em Tempo Real", desc: "Notificações instantâneas sobre novos editais, prazos se aproximando e retificações importantes." },
  ]

  const steps = [
    { num: "01", title: "Busca nos Portais",  desc: "O sistema varre mais de 5 portais governamentais e agências de fomento, coletando todos os editais abertos — 24h por dia, 7 dias por semana." },
    { num: "02", title: "Análise por IA",     desc: "Nossa IA baixa os PDFs, extrai informações-chave e classifica o edital por área (TI, Pesquisa, Inovação) e nível de relevância para sua instituição." },
    { num: "03", title: "Projeto Criado",     desc: "Com um clique, gere a estrutura completa do seu projeto de captação, alinhada às exigências do edital e ao perfil da sua instituição." },
  ]

  const portals = ["Prosas", "FINEP", "CNPq", "CAPES", "Min. Ciência", "FAPESP", "BNDES", "FAPs"]

  const editais = [
    { title: "Chamada CNPq — IA & Machine Learning 2026", org: "CNPq · Prazo: 30 dias",    badgeClass: "lp-db-badge-open", badge: "Aberto" },
    { title: "FINEP — Inovação Tecnológica para Startups", org: "FINEP · Prazo: 15 dias", badgeClass: "lp-db-badge-ai",   badge: "IA Analisado" },
    { title: "CAPES — Educação Digital e Transformação",  org: "CAPES · Publicado hoje",   badgeClass: "lp-db-badge-new",  badge: "Novo" },
  ]

  return (
    <div className="landing">
      {/* Background atmosphere */}
      <div className="lp-bg-grid"  aria-hidden="true" />
      <div className="lp-bg-dots"  aria-hidden="true" />

      {/* ── Header ── */}
      <header className="lp-header">
        <a className="lp-logo" href="/" aria-label="CaptaMais — página inicial">
          <div className="lp-logo-icon" aria-hidden="true">C+</div>
          <span className="lp-logo-text">Capta<span>Mais</span></span>
        </a>
        <nav className="lp-nav" aria-label="Navegação principal">
          <button id="lp-btn-login" className="lp-btn-primary" onClick={() => router.push("/login")}>Entrar</button>
        </nav>
      </header>

      <main className="lp-content">

        {/* ── Hero ── */}
        <section className="lp-hero" aria-labelledby="hero-heading">
          <div className="lp-hero-inner">
            <div className="lp-hero-badge" role="note">
              <span className="lp-badge-dot" aria-hidden="true" />
              IA para Captação de Recursos Públicos
            </div>

            <h1 className="lp-hero-title" id="hero-heading">
              Encontre, analise e crie<br />
              seu projeto de captação{" "}
              <span className="lp-gradient-text">automaticamente</span>
            </h1>

            <p className="lp-hero-subtitle">
              O CaptaMais varre portais governamentais, baixa editais, usa IA para extrair o que importa
              e gera a estrutura do seu projeto — tudo em minutos, sem esforço manual.
            </p>

            <div className="lp-hero-ctas">
              <button
                id="lp-cta-main"
                className="lp-btn-hero lp-btn-hero-main"
                onClick={() => router.push("/login")}
              >
                Entrar na Plataforma
                <IconArrowRight />
              </button>
            </div>

            <div className="lp-hero-trust">
              <div className="lp-trust-avatars" aria-hidden="true">
                {["U", "P", "F", "C"].map((l, i) => (
                  <div key={i} className="lp-trust-avatar">{l}</div>
                ))}
              </div>
              <p className="lp-trust-text">
                <strong>+2.000 instituições</strong> já captaram mais com o CaptaMais
              </p>
            </div>

            {/* Dashboard preview mock */}
            <div
              className="lp-hero-visual"
              role="img"
              aria-label="Prévia do dashboard mostrando editais analisados por IA"
            >
              <div className="lp-db-preview" aria-hidden="true">
                <div className="lp-db-topbar">
                  <div className="lp-db-dot lp-db-dot-r" />
                  <div className="lp-db-dot lp-db-dot-y" />
                  <div className="lp-db-dot lp-db-dot-g" />
                  <div className="lp-db-url">captamais.app/dashboard</div>
                </div>
                <div className="lp-db-body">
                  <div className="lp-db-row">
                    <div className="lp-db-stat">
                      <div className="lp-db-stat-label">Editais Ativos</div>
                      <div className="lp-db-stat-val">147</div>
                      <div className="lp-db-stat-sub">↑ 12 novos hoje</div>
                    </div>
                    <div className="lp-db-stat">
                      <div className="lp-db-stat-label">Analisados por IA</div>
                      <div className="lp-db-stat-val">102</div>
                      <div className="lp-db-stat-sub">↑ 69% do total</div>
                    </div>
                    <div className="lp-db-stat">
                      <div className="lp-db-stat-label">Recursos Mapeados</div>
                      <div className="lp-db-stat-val">R$ 2.5B</div>
                      <div className="lp-db-stat-sub">↑ Em editais abertos</div>
                    </div>
                  </div>
                  <div className="lp-db-edital-list">
                    {editais.map((ed, i) => (
                      <div key={i} className="lp-db-edital">
                        <div>
                          <div className="lp-db-edital-title">{ed.title}</div>
                          <div className="lp-db-edital-meta">{ed.org}</div>
                        </div>
                        <div className={`lp-db-badge ${ed.badgeClass}`}>{ed.badge}</div>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="lp-db-progress-label">
                      <span>Pipeline de análise</span>
                      <span>69%</span>
                    </div>
                    <div className="lp-db-progress-bar">
                      <div className="lp-db-progress-fill" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Portals strip ── */}
        <div className="lp-portals-strip">
          <p className="lp-portals-label">Monitoramos automaticamente</p>
          <div className="lp-portals-row" role="list" aria-label="Portais monitorados">
            {portals.map((p) => (
              <div key={p} className="lp-portal-chip lp-reveal" role="listitem">{p}</div>
            ))}
          </div>
        </div>

        {/* ── How it works ── */}
        <section className="lp-section lp-how-bg" aria-labelledby="how-heading">
          <div className="lp-section-inner">
            <div className="lp-reveal">
              <div className="lp-section-label" aria-hidden="true">Como funciona</div>
              <h2 className="lp-section-title" id="how-heading">
                Da busca ao projeto em<br />
                <span style={{ color: "var(--lp-accent-light)" }}>3 etapas automatizadas</span>
              </h2>
              <p className="lp-section-subtitle">
                Enquanto você foca no seu trabalho, o CaptaMais cuida de toda a inteligência de captação.
              </p>
            </div>

            <div className="lp-steps-grid" role="list">
              {steps.map((step, i) => (
                <div key={i} className={`lp-step-card lp-reveal lp-reveal-d${i + 1}`} role="listitem">
                  {i < steps.length - 1 && (
                    <div className="lp-step-connector" aria-hidden="true"><IconChevronRight /></div>
                  )}
                  <div className="lp-step-num" aria-hidden="true">{step.num}</div>
                  <h3 className="lp-step-title">{step.title}</h3>
                  <p className="lp-step-desc">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Stats ── */}
        <section className="lp-section lp-stats-bg" aria-labelledby="stats-heading">
          <div className="lp-section-inner">
            <h2 id="stats-heading" className="sr-only">Números do CaptaMais</h2>
            <div className="lp-stats-grid">
              <StatCard value={15000}          prefix="+"  suffix=""  label="Editais Monitorados" />
              <StatCard value={2_500_000_000}  prefix="R$" suffix="B" label="Recursos Mapeados" />
              <StatCard value={2300}                                   label="Instituições Ativas" />
              <StatCard value={85}                         suffix="%" label="Taxa de Aprovação" />
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section className="lp-section" aria-labelledby="features-heading">
          <div className="lp-section-inner">
            <div className="lp-reveal" style={{ textAlign: "center", marginBottom: "1rem" }}>
              <div className="lp-section-label" aria-hidden="true">Funcionalidades</div>
              <h2 className="lp-section-title" id="features-heading">
                Tudo o que você precisa para<br />
                <span style={{ color: "var(--lp-accent-light)" }}>captar mais e melhor</span>
              </h2>
              <p className="lp-section-subtitle" style={{ margin: "0 auto" }}>
                Uma plataforma completa que combina IA avançada com uma interface intuitiva para transformar sua gestão de editais.
              </p>
            </div>

            <div className="lp-features-grid" role="list">
              {features.map((f, i) => (
                <div key={i} className={`lp-feature-card lp-reveal lp-reveal-d${(i % 3) + 1}`} role="listitem">
                  <div
                    className="lp-feature-glow"
                    style={{ background: `var(--lp-${f.color})` }}
                    aria-hidden="true"
                  />
                  <div className={`lp-feature-icon lp-feature-icon-${f.color}`}>
                    {f.icon}
                  </div>
                  <h3 className="lp-feature-title">{f.title}</h3>
                  <p className="lp-feature-desc">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="lp-cta-section" aria-labelledby="cta-heading">
          <div className="lp-cta-card lp-reveal">
            <div className="lp-cta-glow-1" aria-hidden="true" />
            <div className="lp-cta-glow-2" aria-hidden="true" />
            <h2 className="lp-cta-title" id="cta-heading">
              Pronto para captar recursos<br />
              <span style={{ color: "var(--lp-accent-light)" }}>sem esforço manual?</span>
            </h2>
            <p className="lp-cta-sub">
              Configure em menos de 5 minutos e deixe nossa IA fazer o trabalho pesado —
              busca, análise e geração de projetos automaticamente.
            </p>
            <div className="lp-cta-checklist" role="list">
              {[
                "Busca automática 24/7",
                "Análise completa por IA",
                "Geração de projetos",
                "Alertas de prazos",
                "Sem configuração",
              ].map((item) => (
                <div key={item} className="lp-cta-check-item" role="listitem">
                  <IconCheck />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <button
              id="lp-cta-final"
              className="lp-btn-hero lp-btn-hero-main"
              onClick={() => router.push("/login")}
            >
              Entrar na Plataforma
              <IconArrowRight />
            </button>
          </div>
        </section>

      </main>

      {/* ── Footer ── */}
      <footer>
        <div className="lp-footer-inner">
          <a className="lp-logo" href="/" aria-label="CaptaMais — início">
            <div className="lp-logo-icon" aria-hidden="true">C+</div>
            <span className="lp-logo-text">Capta<span>Mais</span></span>
          </a>
          <nav className="lp-footer-links" aria-label="Links do rodapé">
            {["Sobre", "Funcionalidades", "Portais", "Suporte"].map((link) => (
              <a key={link} href="#" className="lp-footer-link">{link}</a>
            ))}
          </nav>
          {/* suppressHydrationWarning prevents year mismatch between SSR and client */}
          <p className="lp-footer-copy" suppressHydrationWarning>
            © {year ?? "2026"} CaptaMais Tecnologia. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  )
}
