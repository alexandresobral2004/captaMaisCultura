# Capta+ - Gestão de Editais

> **📍 Localização:** `docs/01-introducao/01-readme.md`
> **📅 Última revisão:** 04/06/2026
> **📚 Índice geral:** [`docs/00-INDICE.md`](../00-INDICE.md)

Sistema de gestão inteligente de editais e captação de recursos para instituições públicas e privadas.

## 🚀 Tecnologias

- **Next.js 14** - Framework React
- **TypeScript** - Tipagem estática
- **SQLite + Drizzle ORM** - Persistência relacional local
- **CSS Customizado** - Flexbox e CSS Grid
- **Lucide React** - Ícones
- **OpenAI GPT-4o-mini** - Classificação e análise inteligente
- **node-cron** - Agendamento semanal de varreduras
- **Tavily MCP** - Pesquisa e enriquecimento semântico

## 📦 Instalação

```bash
# Instalar dependências
npm install

# Executar em desenvolvimento
npm run dev

# Build para produção
npm run build

# Executar produção
npm start
```

## 🎨 Funcionalidades

- ✅ Dashboard com visão geral
- ✅ Exploração de editais com busca full-text (FTS5)
- ✅ Gestão de usuários da instituição
- ✅ Sistema de login com autenticação
- ✅ Interface responsiva (dark/light mode)
- ✅ Pipeline automatizado de 4 etapas (BUSCAR → BAIXAR → ANALISAR → GERAR PROJETO)
- ✅ Integração com 5+ portais brasileiros (Prosas, FINEP, CNPq, CAPES, Min. Ciência)
- ✅ Filtros inteligentes (whitelist + OpenAI + blacklist)
- ✅ Notificações push de novos editais
- ✅ Revisão humanizada de editais pela IA
- ✅ Geração automática de projetos a partir de editais aprovados

## 📁 Estrutura do Projeto

```
captaMais/
├── app/                          # Páginas e API Routes (Next.js 14)
│   ├── api/                      # Endpoints REST
│   │   ├── editais/              # CRUD de editais
│   │   ├── v1/                   # API versionada (SQLite + Drizzle)
│   │   └── jobs/                 # Agendamentos
│   ├── dashboard/                # Dashboard principal
│   ├── editais/                  # Exploração de editais
│   ├── projetos/                 # Projetos aprovados
│   ├── configuracoes/            # Configurações (filtros, portais, logs)
│   └── login/                    # Autenticação
├── components/                   # Componentes React
│   ├── layout/                   # Layout (sidebar, topbar)
│   ├── ui/                       # Componentes UI base
│   └── *.tsx                     # Componentes de domínio
├── lib/                          # Lógica de negócio
│   ├── ai/                       # OpenAI, prompts, validação
│   ├── scraper/                  # Web scraping, PDF, filtros
│   ├── database/                 # Drizzle ORM + repositórios
│   ├── jobs/                     # Cron scheduler
│   ├── api/                      # Auth, validators, responses
│   └── api-client/               # Cliente HTTP para o frontend
├── data/                         # Dados persistidos (SQLite + arquivos)
│   ├── db/                       # Banco SQLite
│   ├── downloads/                # PDFs baixados
│   ├── filtros/                  # Whitelist/blacklist/categorias
│   └── notificacoes/             # Notificações geradas
├── docs/                         # 📚 Documentação (índice em 00-INDICE.md)
├── scripts/                      # Scripts utilitários (busca, migração, cron)
├── __tests__/                    # Testes automatizados (Vitest)
└── .agent/                       # Skills do agente
```

## 🎯 Próximos Passos

- [ ] Aumentar cobertura de testes para >80%
- [ ] Implementar autenticação OAuth2 com provedores externos
- [ ] Migrar para PostgreSQL em produção
- [ ] Adicionar mais portais (FAPs estaduais, fundações privadas)
- [ ] Implementar cache distribuído (Redis) para análises IA

## 📚 Documentação

Toda a documentação foi consolidada e está em [`docs/00-INDICE.md`](../00-INDICE.md). Lá você encontra:

- Guias rápidos e quickstart
- Arquitetura do sistema e mapas do projeto
- Documentação da API e banco de dados
- Fluxos do pipeline de editais
- Detalhes de implementação
- Sistema de filtragem por keywords
- Integrações com portais
- Skills do agente
- Relatórios de testes e análises

## 📝 Licença

Este projeto é privado e de uso interno.
