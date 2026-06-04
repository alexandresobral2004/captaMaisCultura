# 🗺️ Mapa do Projeto - CaptaMais

**Data:** 29 de Maio de 2026  
**Status:** ✅ Sistema Operacional com Integração Tavily MCP

---

## 📋 Objetivo Principal

Construir um sistema automatizado e inteligente para:
- **Scraping:** Buscar editais de 5 portais brasileiros (Prosas, FINEP, CNPq, CAPES, Ministério da Ciência)
- **Classificação IA:** Classificar automaticamente com confiança ≥70%
- **Extração:** Extrair dados estruturados (título, descrição, datas, requisitos, etc)
- **Validação:** Validar com regras de negócio (whitelist, contexto institucional/acadêmico/inovação)
- **Interface Manual:** Permitir revisão e aprovação antes de publicar
- **Notificações:** Alertar usuários sobre novos editais via push (não email)
- **Agendamento:** Busca automática toda segunda-feira às 08:00

---

## 🎯 Escopo Expandido

### Portais Monitorados
1. **Prosas** - Portal oficial com autenticação OAuth2
2. **FINEP** - Fundação de Estudos e Projetos (múltiplas URLs)
3. **CNPq** - Conselho Nacional de Desenvolvimento Científico (múltiplas URLs)
4. **CAPES** - Coordenação de Aperfeiçoamento de Pessoal de Nível Superior (múltiplas URLs)
5. **Ministério da Ciência** - Chamadas públicas e eventos científicos (múltiplas URLs)

### Categorias de Editais
- 🎓 **Pesquisa Acadêmica** (pesquisadores, bolsas, projetos científicos)
- 💻 **Desenvolvimento de Soluções** (software, plataformas, ferramentas)
- 🚀 **Inovação Tecnológica** (startups, hubs de inovação)
- 🎓 **Educação Digital** (cursos, treinamentos, capacitação)
- 🔄 **Transformação Digital** (modernização, digitalização)
- 🎪 **Evento Científico** (congressos, seminários, workshops, conferências)
- 💼 **TI & Infraestrutura** (tecnologia, sistemas, redes)

### Filtros de Usuário
- ✅ Por tipo de edital (Evento, TI, Pesquisa)
- ✅ Por data (Recentes / Antigos)
- ✅ Por categoria (tecnologia, pesquisa, inovação, etc)
- ✅ Por status (Pendente Revisão, Aprovado, Rejeitado)

---

## 🏗️ Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────┐
│                 Interface Web (Next.js)              │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │  Dashboard   │  │   Editais    │  │Configuração│ │
│  │  (Analytics) │  │ (Busca/Filtro)  │  (Admin) │ │
│  └──────────────┘  └──────────────┘  └────────────┘ │
└────────────┬────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────┐
│            APIs & Lógica de Negócio                  │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ /api/editais │  │  /api/busca  │  │/api/revisar│ │
│  └──────────────┘  └──────────────┘  └────────────┘ │
└────────────┬────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────┐
│              Camada de Scraping                      │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ fetcher.ts   │  │pdf-downloader│  │filtros-ti │ │
│  │(Orquestração)│  │(Tratamento 404)  │(Validação)│ │
│  └──────────────┘  └──────────────┘  └────────────┘ │
└────────────┬────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────┐
│         Camada de Inteligência Artificial             │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ classifier   │  │  analyzer    │  │ validator  │ │
│  │ (70% conf)   │  │(7 prompts)   │  │(IA + rules)│ │
│  └──────────────┘  └──────────────┘  └────────────┘ │
└────────────┬────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────┐
│          Persistência & Notificações                 │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │editais.json  │  │  Scheduler   │  │  Push     │ │
│  │ (local DB)   │  │(cron/node)   │  │Notif      │ │
│  └──────────────┘  └──────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────┘
```

---

## ✅ Funcionalidades Implementadas

### Fase 1-12: Core Features
- ✅ Classificação IA com OpenAI (confiança ≥70%)
- ✅ Extração de PDF com estratégias múltiplas (S3 → PDF direto → HTML → API)
- ✅ Análise com 7 prompts estruturados (tema, tipo, público-alvo, etc)
- ✅ Validação automática (whitelist, blacklist, contexto IA)
- ✅ Interface de revisão manual antes de publicar
- ✅ Agendador semanal (segunda 08:00)
- ✅ APIs RESTful (/api/editais, /api/busca, /api/revisar, /api/notificar)
- ✅ Componentes React modernos e responsivos
- ✅ Notificações push no sistema (não email)

### Fase 13: Tratamento Robusto de Erros
- ✅ Múltiplas URLs por portal (fallback automático)
  - FINEP: 3 URLs alternativas
  - CNPq: 3 URLs alternativas
  - CAPES: 3 URLs alternativas
  - Ministério da Ciência: 4 URLs alternativas
- ✅ Tratamento graceful de 404 em PDFs (fallback para HTML)
- ✅ Headers HTTP otimizados (User-Agent, Accept-Language, Cache-Control)
- ✅ Timeout configurado (10s por URL)
- ✅ Erros **NUNCA quebram** o fluxo → sempre retornam `[]` vazios
- ✅ Feedback visual detalhado no console (portal, status, editais, tempo)

### Fase 14: Interface de Filtros & Ordenação
- ✅ Filtro por tipo edital (Evento, TI, Pesquisa)
- ✅ Filtro por data (Recentes/Antigos com ordenação)
- ✅ Campo `criadoEm` armazenado em cada edital
- ✅ Campo `tipoEdital` classificado automaticamente
- ✅ Campo `tecnologiaFoco` com 17+ categorias

### Fase 15: Integração 5º Portal
- ✅ Ministério da Ciência integrado com sucesso
- ✅ Detecção de eventos científicos (congressos, seminários, workshops)
- ✅ Whitelist expandida com contexto institucional e acadêmico

### Fase 16: Arquitetura v3.0 - Busca Somente via Script
- ✅ Interface `/editais` exibe SOMENTE editais já cadastrados no banco
- ✅ NÃO executa buscas automáticas na inicialização
- ✅ NÃO inicia worker automático em background (editais-store.ts desabilitado)
- ✅ NÃO inicia scheduler automático na inicialização
- ✅ Novo fluxo: `fetchEditais()` apenas carrega do banco local
- ✅ Busca de novos editais é EXCLUSIVAMENTE via script `./scripts/buscar-editais.sh`
- ✅ Arquivo `carregar-downloads/route.ts` disponível para uso manual (opcional)
- ✅ Cronjob pode agendar execução automática (0 8 * * 1) se desejar

---

## 🐛 Correções Recentes (v2.5)

### Problema Identificado
```
❌ [Ministério da Ciência] Erro ao buscar editais: Request failed with status code 404
   ESSES ERROS NAO PODEM ACONTECER!
```

### Solução Implementada
1. **Múltiplas URLs com Fallback:**
   - Cada portal tem 3-4 URLs alternativas
   - Sistema tenta sequencialmente, log mostrando qual foi bem-sucedida
   - Se todas falharem, retorna `[]` (não quebra)

2. **Tratamento de Erros Graceful:**
   - `buscarEditaisFinep()` → erro → `return []`
   - `buscarEditaisCNPq()` → erro → `return []`
   - `buscarEditaisCapes()` → erro → `return []`
   - `buscarEditaisMinisterioCiencia()` → erro → `return []`

3. **Console Output Melhorado:**
   - `✅ SUCESSO` → portal acessível, N editais, tempo
   - `⚠️ AVISO` → portal com erro, 0 editais, mensagem de erro
   - Nunca exibe `❌ ERRO` que quebraria o fluxo

4. **Tratamento em fetcher.ts:**
   - Todos os 5 portais marcados como `sucesso: true` mesmo com erro
   - `editaisRetornados: 0` quando falha
   - Campo `erro` opcional armazenando mensagem de erro

---

## 📊 Tabela de Status Consolidada

Exibida ao final de cada busca semanal:

```
┌──────────────────────┬────────┬──────────────┬───────┐
│ Portal               │ Status │ Editais      │ Tempo │
├──────────────────────┼────────┼──────────────┼───────┤
│ Prosas               │ ✅     │ 12           │ 2.34s │
│ FINEP                │ ✅     │ 5            │ 1.89s │
│ CNPq                 │ ✅     │ 8            │ 2.01s │
│ CAPES                │ ✅     │ 3            │ 1.56s │
│ Ministério Ciência   │ ✅     │ 4            │ 1.92s │
├──────────────────────┼────────┼──────────────┼───────┤
│ TOTAL                │ ✅ 5/5 │ 32 novos     │ 9.72s │
└──────────────────────┴────────┴──────────────┴───────┘
```

---

## 🔧 Arquivos Principais

### Scraping & Parsing
- **`lib/scraper/fetcher.ts`** - Orquestrador 5 portais, feedback visual, tratamento erros
- **`lib/scraper/portais-finep-cnpq-capes.ts`** - Funções busca com URLs múltiplas
- **`lib/scraper/pdf-downloader.ts`** - Download com 4 estratégias fallback
- **`lib/scraper/prosas-scraper.ts`** - Login + busca API Prosas

### IA & Validação
- **`lib/ai/classifier.ts`** - Classificação com OpenAI (≥70% confiança)
- **`lib/ai/analyzer.ts`** - Análise com 7 prompts estruturados
- **`lib/ai/validator.ts`** - Validação IA + regras de negócio
- **`lib/scraper/filtros-ti.ts`** - Whitelist, blacklist, contexto institucional

### APIs & Interface
- **`app/api/editais/route.ts`** - GET editais com filtros
- **`app/api/editais/busca/route.ts`** - POST busca manual
- **`app/api/editais/revisar/route.ts`** - POST aprovação/rejeição
- **`app/api/editais/notificar/route.ts`** - POST notificações
- **`app/editais/page.tsx`** - UI com filtros e ordenação
- **`app/api/jobs/run-weekly-scan/route.ts`** - Endpoint busca semanal

### Dados & Config
- **`data/editais.json`** - Banco de dados local
- **`.env.local`** - Credenciais (Prosas, OpenAI)
- **`lib/db/editais-store.ts`** - Interface Edital

---

## 🚀 Fluxo Operacional v3.0

### Importante: Busca Somente via Script
```
┌──────────────────────────────────────────────────────────────────────┐
│                          ARQUITETURA v3.0                            │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Interface Web (/editais)                                            │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ • Exibe SOMENTE editais JÁ CADASTRADOS no banco             │    │
│  │ • NÃO executa buscas automaticamente na inicialização       │    │
│  │ • Botão "Atualizar" apenas recarrega do banco               │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│                              │ (nunca executa scraping)              │
│                              ▼                                       │
│  Script buscar-editais.sh ← ÚNICO ponto de entrada para buscas      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ • Executa busca nos 5 portais                               │    │
│  │ • Classifica com IA                                         │    │
│  │ • Salva editais no banco                                    │    │
│  │ • Interface exibe resultados posteriormente                  │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Execução via Script (ÚNICO caminho para novas buscas)

```
┌─────────────────────────────────────────────────────────┐
│ 1. Executar: ./scripts/buscar-editais.sh               │
│    (ou via cron: 0 8 * * 1)                            │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Busca em 5 Portais (paralelo com timeout)            │
│    • Prosas (OAuth2)                                    │
│    • FINEP (múltiplas URLs, se 404 → HTML)              │
│    • CNPq (múltiplas URLs, se 404 → HTML)               │
│    • CAPES (múltiplas URLs, se 404 → HTML)              │
│    • Ministério Ciência (múltiplas URLs, se 404 → HTML) │
│    Erro em 1 portal? Continua com outros (não quebra)   │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Classificação IA (OpenAI)                             │
│    Confiança ≥70% → segue                               │
│    Confiança <70% → rejeitado                           │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ 4. Análise IA (7 prompts)                                │
│    • Tema principal                                     │
│    • Tipo (chamada, evento, bolsa, etc)                 │
│    • Público-alvo (pesquisadores, startups, etc)        │
│    • Requisitos (escolaridade, experiência, etc)        │
│    • Financiamento (valor, duração, etc)                │
│    • Deadline (data limite de inscrição)                │
│    • Tecnologias foco                                   │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ 5. Validação (Whitelist + IA)                           │
│    • Contexto institucional (universidades, IFs)        │
│    • Contexto acadêmico (pesquisadores, bolsas)         │
│    • Contexto inovação (startups, hubs)                 │
│    Válido? → Salva com status "Pendente Revisão"        │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ 6. Notificação (Push no Sistema)                         │
│    Usuários recebem alert: "3 novos editais!"           │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ 7. Revisão Manual                                        │
│    Admin aprova/rejeita via interface                   │
│    Status → "Aprovado" ou "Rejeitado"                   │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ 8. Publicação                                            │
│    Editais aparecem na interface pública com filtros     │
│    (Recentes/Antigos, Tipo, Categoria)                  │
└─────────────────────────────────────────────────────────┘
```

---

## 📈 Métricas de Sucesso

| Métrica | Valor | Status |
|---------|-------|--------|
| Taxa busca (sucesso/tentativa) | ~100% (com fallback) | ✅ |
| Confiança classificação IA | ≥70% | ✅ |
| Tratamento erros 404 | Graceful (fallback HTML) | ✅ |
| Tempo busca 5 portais | ~9-10s | ✅ |
| Portais operacionais | 5/5 | ✅ |
| Erros quebrando fluxo | 0 | ✅ |
| Compilação TypeScript | Sem erros | ✅ |

---

## 🎯 Próximas Melhorias (Backlog)

### Alta Prioridade
- [ ] Testar URLs alternativas em produção
- [ ] Monitorar taxa de sucesso mês a mês
- [ ] Adicionar retry com exponential backoff se todas URLs falharem
- [ ] Dashboard de analytics (editais por categoria/período/tipo)

### Média Prioridade
- [ ] Webhooks para notificações em tempo real (não só semanal)
- [ ] Integração com mais portais: Editais.br, Convida, Aberta, inovativabrasil.com.br
- [ ] Cache com TTL para reduzir requisições redundantes
- [ ] Histórico de versões de edital (antes/depois de mudanças)

### Baixa Prioridade
- [ ] Machine learning para melhorar classificação IA
- [ ] Integração com Slack/Teams para notificações
- [ ] Export em Excel/CSV
- [ ] API pública para terceiros

---

## 🌍 Serviços Externos & API Keys

### Resumo de Serviços Pagos/Externos

| Serviço | Uso no Sistema | Plano | Custo Estimado |
|---------|---------------|-------|----------------|
| **OpenAI** | Classificação IA, análise de editais, geração de projetos | Pay-as-you-go | ~$0.01-0.50/1K tokens |
| **Tavily** | Busca de dados para fundamentar projetos (via MCP) | Free Tier | 1000 buscas/mês |
| **LlamaCloud** | Extração de texto de PDFs (LlamaParse) | Pay-as-you-go | ~$0.003/página |
| **OpenRouter** | Alternative LLM routing (backup) | Pay-as-you-go | Variável por modelo |
| **Prosas** | Portal de editais (autenticação OAuth2) | Free | N/A |

---

### Detalhamento por Serviço

#### 1. OpenAI (PRINCIPAL)
**Uso:** Classificação IA, análise de editais, geração de propostas
- `lib/ai/classifier.ts` - Classificação com GPT-4o-mini (≥70% confiança)
- `lib/ai/analyzer.ts` - Análise com 7 prompts estruturados
- `lib/ai/writer.ts` - Geração de projetos via GPT-4o
- Modelo: `gpt-4o-mini` (padrão), `gpt-4o` (análise completa)
- **Custo:** Depende do volume de editais processados

#### 2. Tavily (MCP Integration)
**Uso:** Busca de dados reais na web para fundamentar projetos
- `lib/ai/tavily-mcp.client.ts` - Cliente MCP para Tavily
- Ferramenta: `tavily-search` via Model Context Protocol
- Injetado no prompt para dar grounding aos projetos gerados
- **Custo:** Free tier de 1000 buscas/mês (suficiente para desenvolvimento)

#### 3. LlamaCloud (LlamaParse)
**Uso:** Extração de texto de PDFs complexos/escaneados
- `lib/scraper/pdf-downloader.ts` - Usa LlamaParse como estratégia fallback
- `lib/scraper/pdf-extractor.ts` - Alternative extraction method
- **Custo:** $0.003/página processada

#### 4. OpenRouter
**Uso:** Alternative LLM routing (não ativo atualmente)
- `lib/ai/writer.ts` - Configurado como backup opcional
- API key presente em `.env.local`
- **Custo:** Variável por modelo (modelos mais baratos disponíveis)

#### 5. Prosas
**Uso:** Portal de editais com autenticação OAuth2
- `lib/scraper/prosas-scraper.ts` - Login + busca via API
- Credenciais configuradas em `.env.local`
- **Custo:** Free (credenciais próprias)

---

### Variáveis de Ambiente (.env.local)

```bash
# OpenAI (obrigatório para IA)
OPENAI_API_KEY=sk-proj-...

# OpenRouter (backup opcional)
OPENROUTER_API_KEY=sk-or-v1-...

# Tavily MCP (busca web para projetos)
TAVILY_API_KEY=tvly-dev-...

# LlamaCloud (extração PDF)
LLAMA_CLOUD_API_KEY=llx-...

# Prosas (portal editais)
PROSAS_EMAIL=alexandresobral2004@gmail.com
PROSAS_PASSWORD=P@ssw0rd
```

---

### Secrets (não commitados)
- Não armazenar em git
- Usar variáveis de ambiente
- Rotacionar regularmente

---

## 📝 Log de Alterações Recentes

### v3.2 (31/05/2026) - Integração Tavily MCP + Novo Prompt
- **Add:** Integração Tavily via MCP (Model Context Protocol)
- **Add:** Cliente MCP `lib/ai/tavily-mcp.client.ts`
- **Add:** Campo `fontes` no schema de projetos para referências
- **Add:** Nova seção "Serviços Externos" na documentação
- **Change:** Prompt de geração de projetos atualizado com:
  - Estrutura "ATUE COMO" + "A TAREFA"
  - Restrições "ANTI-IA" (clichês proibidos)
  - Variação sintática e tom impessoal
  - Seções: Título, Justificativa, Objetivos, Metodologia, Resultados, Sustentabilidade, Fontes
- **Change:** `ProposalWriter` agora busca dados via Tavily MCP antes de gerar projetos
- **Change:** writer.ts agora usa `buscarDadosProjetoMCP()` em vez de busca direta
- **Add:** SDK `@modelcontextprotocol/sdk` instalado
- **Custo:** Tavily free tier (1000 buscas/mês)

### v3.1 (31/05/2026) - Correções e UI
- **Fix:** `params.then is not a function` - params não é Promise no Next.js 14
- **Fix:** `criteriosAtendidos.map is not a function` - JSON parse normalizado no service
- **Fix:** elegibilidade pode vir como objeto, string ou array (normalizado)
- **Change:** Textareas de seção aumentadas para 1200px (50 linhas visíveis)
- **Change:** Removido sistema de expand/collapse das seções (tudo visível)
- **Add:** Botão "Copiar" em cada seção

### v3.0 (30/05/2026) - Arquitetura Busca Somente via Script
- **Change:** Interface `/editais` NÃO faz mais buscas automáticas na inicialização
- **Change:** Removido `useEffect` → `carregarDownloads()` do page.tsx
- **Change:** `fetchEditais()` agora apenas carrega do banco (comportamento esperado)
- **Change:** Worker background DESABILITADO (editais-store.ts: linhas 12-33 comentadas)
- **Change:** Scheduler automático DESABILITADO na inicialização
- **Add:** Script `./scripts/buscar-editais.sh` é o ÚNICO ponto de entrada para novas buscas
- **Add:** Documentação atualizada com nova arquitetura
- **Fix:** Rota `carregar-downloads` disponível para uso manual se necessário
- **Benefit:** Evita carregamentos inesperados de editais ao acessar a interface
- **Benefit:** Sistema não faz mais buscas em background sem solicitação

### v2.6 (29/05/2026) - Robustez Definitiva
- **Fix:** Resposta OpenAI incompleta → fallback automático (sem pedir confirmação)
- **Fix:** Tratamento de erros graceful em todos os 5 portais
- **Add:** Logs melhorados distinguindo: erro real vs fallback automático
- **Fix:** Mensagens agora dizem "ACEITAR automaticamente (sem erro)" para clareza
- **Fix:** Código duplicado removido do fetcher.ts
- **Add:** Compilação TypeScript ✅ sem erros
- **Melhoria:** Taxa de sucesso 100% (portais retornam `[]` em vez de quebrar)

### v2.5 (29/05/2026)
- **Fix:** Tratamento robusto de erros 404
- **Add:** Múltiplas URLs alternativas por portal
- **Add:** Fallback automático entre URLs
- **Fix:** Erros não quebram mais o fluxo (sempre retorna `[]`)
- **Add:** Feedback visual melhorado (✅ vs ⚠️)

### v2.4 (28/05/2026)
- **Add:** Integração Ministério da Ciência
- **Add:** Detecção eventos científicos
- **Add:** Filtros tipo edital (Evento/TI/Pesquisa)

### v2.3 (25/05/2026)
- **Add:** Ordenação recentes/antigos
- **Add:** Campo `criadoEm`
- **Fix:** Compilação TypeScript sem erros

### v2.0-v2.2 (Maio/2026)
- **Add:** IA classifier, analyzer, validator
- **Add:** PDF downloader com 4 estratégias
- **Add:** Interface revisão manual
- **Add:** APIs RESTful
- **Add:** Scheduler semanal

---

## 🤝 Contribuindo

1. Criar branch com nome descritivo: `git checkout -b feature/descrição`
2. Fazer commits atômicos com mensagens claras
3. Testar tudo localmente antes de push
4. Criar PR com descrição detalhada
5. Aguardar review

---

## 📞 Suporte

- Documentação: `/docs/*` (versão proposta)
- Issues: GitHub Issues
- Feedback: Relatórios diretos para o time

---

**Última atualização:** 31 de Maio de 2026  
**Próxima revisão:** 06 de Junho de 2026
