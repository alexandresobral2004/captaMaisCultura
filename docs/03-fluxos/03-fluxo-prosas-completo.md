# 🔐 FLUXO COMPLETO: Sistema Acessando Prosas.com.br

> **📍 Localização:** `docs/03-fluxos/03-fluxo-prosas-completo.md`
> **📅 Última revisão:** 04/06/2026
> **📚 Índice geral:** [`docs/00-INDICE.md`](../00-INDICE.md)

## ✅ RESPOSTA CURTA

**SIM! O sistema está configurado para:**
1. ✅ Logar no Prosas.com.br com credenciais reais
2. ✅ Navegar e buscar editais via API
3. ✅ Baixar PDFs dos editais
4. ✅ Cadastrar automaticamente no banco de dados

---

## 📋 CREDENCIAIS CONFIGURADAS

Arquivo: `.env.local`

```bash
PROSAS_EMAIL=alexandresobral2004@gmail.com
PROSAS_PASSWORD=P@ssw0rd
OPENAI_API_KEY=sk-proj-...
```

---

## 🔄 FLUXO DETALHADO PASSO A PASSO

### **PASSO 1: Disparar Varredura**

```bash
POST /api/jobs/run-weekly-scan
```

Ou automático toda segunda-feira às 08:00

---

### **PASSO 2: Acessar Prosas.com.br**

**Arquivo:** `lib/scraper/prosas-scraper.ts:realizarLoginProsas()`

**Sequência:**

```
1. Carrega sessão salva (data/prosas-session.json)
2. Se sessão vazia/expirada → login via formulário
   ├─ GET /users/sign_in (HTML) → extrai CSRF token
   ├─ POST /users/sign_in (form: user[email], user[password], authenticity_token)
   └─ Cookies de autenticação salvos
3. Solicita token OAuth2
   ├─ POST /auth/oauth2/token
   ├─ client_id=lsf6jeu7-Wk04P2iSYMdcMhPZUNZqabK8CG6mAfRQ6M
   └─ Retorna access_token (válido 1h)
```

---

### **PASSO 3: Consultar Lista de Editais**

**Endpoint API V2:**

```
GET https://prosas.com.br/selecao/api/v2/third_party/oportunidades/inscricoes_abertas
Headers: Authorization: Bearer {access_token}
Query: ?page[page]=1&page[size]=50
```

**Resposta:**

```json
{
  "data": [
    {
      "id": 123,
      "titulo": "Edital de Inovação em IA",
      "dataPublicacao": "2026-05-01",
      "dataLimite": "2026-07-30"
    }
  ],
  "meta": { "total": 250, "per_page": 50 }
}
```

---

### **PASSO 4: Buscar Detalhes de Cada Edital**

Para cada ID da listagem:

```
GET https://prosas.com.br/selecao/api/v2/third_party/oportunidades/{id}?include=arquivos,sites
Headers: Authorization: Bearer {access_token}
```

**Resposta Rica:**

```json
{
  "data": {
    "id": 123,
    "titulo": "Edital de Inovação em IA",
    "descricao": "<h2>Contexto</h2><p>...</p>",
    "valorMaximo": 50000,
    "dataLimite": "2026-07-30",
    "link": "https://prosas.com.br/editais/123",
    "arquivos": [
      { "url": "https://s3.amazonaws.com/.../edital.pdf", "nome": "edital.pdf" }
    ],
    "sites": [
      { "url": "https://example.com/info" }
    ]
  }
}
```

---

### **PASSO 5: Baixar PDF (3 Estratégias)**

**Arquivo:** `lib/scraper/pdf-downloader.ts`

```
ESTRATÉGIA 1: Tentar URL S3 dos arquivos
  ↓ falha
ESTRATÉGIA 2a: Verificar se link é .pdf direto
  ↓ falha
ESTRATÉGIA 2b: Acessar link, procurar PDF na página
  ↓ falha
ESTRATÉGIA 3: Usar HTML da descrição (converter para texto)
  ↓ falha
RESULTADO: sem_pdf
```

---

### **PASSO 6: Salvar no Banco**

**Arquivo:** `lib/database/repositories/edital.repository.ts`

```typescript
await editalRepository.save(edital);
// Faz upsert por id ou link
// Preserva enriquecimento histórico
```

---

## ⚙️ Endpoints da API V2 Utilizados

| Recurso | Endpoint | Uso |
|---------|----------|-----|
| Listagem | `GET /oportunidades/inscricoes_abertas` | Listar editais abertos com paginação |
| Detalhes | `GET /oportunidades/{id}?include=arquivos,sites` | Buscar dados ricos de um edital |
| Autenticação | `POST /auth/oauth2/token` | Obter token de acesso |
| Login | `POST /users/sign_in` | Login via formulário Rails |
| CSRF | `GET /users/sign_in` | Obter token CSRF |

---

## 🔒 Segurança

- **Sessão cacheada** em `data/prosas-session.json` (evita logins repetidos)
- **Token OAuth2** temporário (renovado a cada 1h)
- **Rate limiting** de 500ms entre requests (evita 429)
- **Retry automático** em caso de 401 (re-autentica)
- **Credenciais** em `.env.local` (nunca commitadas)

---

## 📊 Estatísticas

| Métrica | Valor |
|---------|-------|
| Páginas por sessão | até 10 (500 editais) |
| Detalhes por sessão | até 500 |
| Tempo total | 5-10 minutos |
| Taxa de sucesso | 0% (debug em andamento) |
| Última execução | 2026-05-29 14:25:17 |

> **Nota:** Existem problemas documentados em [`../08-testes-analise/02-analise-prosas-detalhada.md`](../08-testes-analise/02-analise-prosas-detalhada.md) que estão sendo investigados.

---

## 🐛 Problemas Conhecidos

| Problema | Severidade | Status |
|----------|-----------|--------|
| Zero editais retornados | 🔴 Crítico | Em investigação |
| Sessão expira após 8h | 🟡 Médio | Cache de 8h implementado |
| Rate limiting 429 | 🟡 Médio | Backoff exponencial sugerido |
| Processamento sequencial | 🟡 Médio | Paralelização sugerida |

Documentação detalhada de problemas em [`../08-testes-analise/`](../08-testes-analise/).

---

## 📚 Documentação Relacionada

- **Análise detalhada Prosas:** [`../08-testes-analise/02-analise-prosas-detalhada.md`](../08-testes-analise/02-analise-prosas-detalhada.md)
- **Sugestões de fix:** [`../08-testes-analise/03-sugestoes-fix-prosas.md`](../08-testes-analise/03-sugestoes-fix-prosas.md)
- **Mapa de problemas:** [`../08-testes-analise/05-mapa-problemas-prosas.md`](../08-testes-analise/05-mapa-problemas-prosas.md)
- **Fluxo completo:** [`01-fluxo-busca-cadastro.md`](01-fluxo-busca-cadastro.md)
