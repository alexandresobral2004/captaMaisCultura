# 🔐 FLUXO COMPLETO: Sistema Acessando Prosas.com.br

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

```typescript
// 1. Acessa página de login
GET https://prosas.com.br/users/sign_in
  → Extrai CSRF token

// 2. Envia formulário de login
POST https://prosas.com.br/users/sign_in
  Headers:
    - Content-Type: application/x-www-form-urlencoded
    - User-Agent: Mozilla/5.0 (Chrome)
  
  Dados:
    - user[email]: alexandresobral2004@gmail.com
    - user[password]: P@ssw0rd
    - authenticity_token: <token>
    - commit: Entrar

// 3. Sistema retorna cookies de sessão
RESPONSE 302 Redirect
  Set-Cookie: [sessão_autenticada]

// 4. Salva sessão em disco
data/prosas-session.json
```

---

### **PASSO 3: Buscar Editais via API**

**Arquivo:** `lib/scraper/prosas-scraper.ts:tentarBuscaComSessao()`

```typescript
// 1. Obter token OAuth2
POST https://prosas.com.br/auth/oauth2/token
  {
    grant_type: "client_credentials",
    client_id: "lsf6jeu7-...",
    scope: "public"
  }
  RESPONSE: {access_token: "..."}

// 2. Buscar editais abertos (PAGINADO)
GET https://prosas.com.br/selecao/api/v2/third_party/oportunidades/inscricoes_abertas
  Headers:
    Authorization: Bearer {token}
    Accept: application/json
  
  Params:
    include: area_interesses,incentivador
    page[page]: 1
    page[size]: 50

  RESPONSE: {
    data: [
      {
        id: 17880,
        attributes: {
          nome: "Edital FINEP 2024",
          descricao: "Chamada pública...",
          data_limite_inscricao: "2026-05-31",
          link: "https://finep.gov.br/...",
          ...
        }
      },
      ...
    ],
    links: {
      last: ".../...?page[page]=5" // Total de 5 páginas
    }
  }

// 3. Para cada página, buscar TODOS os editais
for pagina = 1 até 5:
  GET .../inscricoes_abertas?page[page]={pagina}&page[size]=50
  → Coleta todos os editais
  → Rate limit: 500ms entre requests
```

---

### **PASSO 4: Buscar Detalhes + Arquivos (PDF)**

**Arquivo:** `lib/scraper/prosas-scraper.ts` (linhas 207-250)

Para **CADA** edital encontrado:

```typescript
// 1. Buscar detalhes com arquivos
GET https://prosas.com.br/selecao/api/v2/third_party/oportunidades/{edital_id}
  Headers:
    Authorization: Bearer {token}
  
  Params:
    include: arquivos,sites

// 2. Resposta inclui arquivos anexados
RESPONSE: {
  data: {
    id: 17880,
    attributes: {
      nome: "Edital FINEP 2024",
      data_limite_inscricao: "2026-05-31",
      ...
    },
    relationships: {
      arquivos: {...}
    }
  },
  included: [
    {
      type: "arquivo",
      attributes: {
        nome: "Edital_FINEP_2024.pdf",
        url: "https://prosas-s3.amazonaws.com/...",
        ...
      }
    }
  ]
}

// 3. Extrai URL do PDF do S3
pdfUrlS3 = "https://prosas-s3.amazonaws.com/..."
```

---

### **PASSO 5: Validação com Whitelist + IA**

**Arquivo:** `lib/scraper/filtros-ti.ts`

```typescript
// 1. Whitelist de palavras-chave TI
validarWhitelistTI(nome, descricao)
  ✓ Contém: "software", "python", "IA", "cloud", "desenvolvimen..."
  ✗ Contém: "esporte", "cultura", "musica", "artes..."

// 2. Se passar na whitelist, validar com OpenAI
validarComOpenAI(nome, descricao)
  → Pergunta à IA: "Este edital é para área de TI?"
  → Resposta: {
      isValido: true,
      score: 92,
      motivo: "Edital de fomento em IA e computação"
    }

// 3. Se score < 70%, DESCARTA (foraDoEscopo = true)
// 4. Se score >= 70%, CONTINUA PROCESSAMENTO
```

---

### **PASSO 6: Download do PDF**

**Arquivo:** `lib/scraper/pdf-downloader.ts`

```typescript
// 1. Tentar baixar do S3
GET https://prosas-s3.amazonaws.com/{arquivo}
  Headers: { User-Agent: "EditialBot/1.0" }
  ResponseType: arraybuffer
  → Salva em: data/downloads/edital-{id}.pdf

// 2. Se S3 falhar, tenta HTML/Link externo
GET {linkExterno}
  → Parse HTML
  → Extrai texto com regex

// 3. Se tudo falhar, usa descrição HTML da API
conteudoCompleto = detalhe.attributes.descricao
```

---

### **PASSO 7: Leitura do PDF**

**Arquivo:** `lib/scraper/pdf-downloader.ts`

```typescript
// Usa pdf-parse para extrair texto
const pdfData = await pdfParse(buffer);
const texto = pdfData.text;

// Limpa e estrutura o texto
textolimpo = texto
  .replace(/<[^>]*>/g, ' ')      // Remove HTML
  .replace(/\s+/g, ' ')          // Remove espaços extras
  .trim()
```

---

### **PASSO 8: Análise com IA (Múltiplos Prompts)**

**Arquivo:** `lib/ai/analyzer.ts`

Para cada PDF, executa 7 análises:

```typescript
// 1. Extrair DATAS
{dataLimite, dataPublicacao, dataResultado}

// 2. Extrair VALORES
{valorMin, valorMax, valor}

// 3. Extrair ELEGIBILIDADE
{tipoProponente, requisitos, abrangencia}

// 4. Extrair DOCUMENTOS
{documentosNecessarios}

// 5. Extrair CRITÉRIOS
{criteriosAvaliacao}

// 6. Gerar RESUMO
{resumo, objetivo}

// 7. VALIDAR CONSISTÊNCIA
{errosValidacao, avisos}
```

Cada análise retorna **confiança 0-100%**

---

### **PASSO 9: Validação de Negócio**

**Arquivo:** `lib/ai/validator.ts`

```typescript
validarCamposEdital(edital):
  ✓ Data limite não é no passado?
  ✓ Valor máximo >= Valor mínimo?
  ✓ Campos obrigatórios preenchidos?
  ✓ Dados fazem sentido juntos?
  ✓ Confiança IA > 70%?
  
  Resultado: {
    ehValido: true|false,
    erros: [{campo, tipo, mensagem}],
    avisos: [{campo, tipo, mensagem}],
    confiancaGeral: 0-100
  }
```

---

### **PASSO 10: Cadastro no Banco**

**Arquivo:** `lib/db/editais-store.ts`

```typescript
const editalProcessado = {
  id: "prosas-17880",
  titulo: "Edital FINEP 2024",
  orgao: "FINEP",
  dataLimite: "2026-05-31",
  valor: "R$ 100.000 a R$ 500.000",
  
  // NOVOS CAMPOS
  confiancaClassificacao: 92,        // IA decidiu: É edital?
  confiancaPorCampo: {
    dataLimite: 95,
    valor: 88,
    elegibilidade: 82,
    ...
  },
  statusRevisao: "pendente",         // Aguardando revisão humana
  
  // PDF e conteúdo
  pdfUrl: "https://prosas-s3...",
  pdfSalvoEm: "data/downloads/edital-prosas-17880.pdf",
  conteudoCompleto: "{texto extraído}",
  
  // Análise
  analiseIA: {
    resumo: "...",
    objetivo: "...",
    requisitos: [...],
    elegibilidade: "...",
    documentosNecessarios: [...],
    criteriosAvaliacao: [...]
  },
  
  errosValidacao: [],
  status: "Aberto",
  criadoEm: "2026-05-29T04:18:00Z"
};

// Salva em: data/editais.json
fs.writeFileSync(FILE_PATH, JSON.stringify([...editais, editalProcessado]));
```

---

### **PASSO 11: Interface de Revisão**

**Arquivo:** `components/EditalReviewCard.tsx`

O usuário vê no dashboard:

```
┌─────────────────────────────────────────┐
│ 📄 Edital FINEP 2024                   │
│                                        │
│ Classificação: 92% ✅                 │
│ ████████████████░░ (92%)              │
│                                        │
│ Título: "Edital..." ✅ 98%            │
│ Data Limite: 31/12/2024 ⚠️ 85%       │
│ Valor Mín: R$ 100.000 ✅ 95%         │
│ Valor Máx: R$ 500.000 ✅ 92%         │
│ Elegibilidade: "ONGs, universidades" │
│                                        │
│ [✅ Aprovar] [📝 Editar] [❌ Rejeitar]│
└─────────────────────────────────────────┘
```

---

### **PASSO 12: Aprovação/Rejeição**

**Arquivo:** `app/api/editais/revisar/route.ts`

```typescript
// Usuário clica "Aprovar"
POST /api/editais/revisar
  {
    id: "prosas-17880",
    acao: "aprovar"  // ou "corrigir" ou "rejeitar"
  }

// Sistema atualiza
edital.statusRevisao = "aprovado";
edital.validadoManualmente = true;
edital.dataAprovacao = new Date();
edital.status = "Aberto";  // Publica no sistema

// Salva em banco
```

---

## 📊 FLUXO VISUAL COMPLETO

```
[SEGUNDA-FEIRA 08:00]
        ↓
[CRON DISPARA]
        ↓
[CONECTA AO PROSAS]
  - Faz login com email + password
  - Obtém token OAuth2
  - Reutiliza sessão se disponível
        ↓
[BUSCA EDITAIS]
  - API: inscricoes_abertas
  - Página 1: 50 itens
  - Página 2: 50 itens
  - ...
  - Total: 150 itens
        ↓
[PARA CADA EDITAL]
  1. Buscar detalhes + arquivos
  2. Extrair URL do PDF do S3
  3. Validar whitelist TI
  4. Validar com OpenAI
  5. Se score < 70%: PULAR
  6. Se score >= 70%: CONTINUAR
        ↓
[BAIXAR PDF]
  - S3 direto
  - Link externo
  - HTML da API
        ↓
[EXTRAIR TEXTO DO PDF]
  - pdf-parse lê o PDF
  - Limpa HTML
  - Resultado: texto puro
        ↓
[ANALISAR COM IA]
  - 7 prompts especializados
  - Extrai datas, valores, elegibilidade, docs
  - Cada campo tem score 0-100%
        ↓
[VALIDAR DADOS]
  - Datas são válidas?
  - Valores fazem sentido?
  - Dados são completos?
        ↓
[SALVAR NO BANCO]
  - status: "aguardando_revisao"
  - Armazena toda análise IA
  - Salva PDF em data/downloads/
        ↓
[NOTIFICAR USUÁRIO]
  - Push no sistema
  - "15 novos editais disponíveis"
        ↓
[USUÁRIO REVISA NO DASHBOARD]
  - Vê card com scores coloridos
  - Pode editar campos
  - Aprova ou rejeita
        ↓
[EDITAL PUBLICADO]
  - Disponível no sistema
  - Pronto para submissão de projetos
```

---

## 🔑 PONTOS-CHAVE

| Aspecto | Como Funciona |
|---------|----------------|
| **Login** | Email + Senha no formulário web do Prosas |
| **Autenticação** | Cookies de sessão + Token OAuth2 |
| **Busca** | API JSON (não web scraping) |
| **PDFs** | Baixados do S3 do Prosas |
| **Processamento** | Local (seu servidor) |
| **Inteligência** | OpenAI (análise em cloud) |
| **Frequência** | Semanal automático (cron) |
| **Revisão** | Interface visual humanizada |
| **Persistência** | JSON local (data/editais.json) |

---

## ⚠️ DEPENDÊNCIAS CRÍTICAS

1. **Credenciais válidas** no `.env.local`
   - Se errado: `❌ Falha no login`
   
2. **Prosas.com.br acessível**
   - Firewall/IP block: `❌ Conexão recusada`
   
3. **Token OpenAI válido**
   - Análise IA não funciona sem API key válida

4. **PDFs acessíveis**
   - S3 do Prosas deve retornar arquivo

---

## 🧪 TESTANDO

### **Teste 1: Verificar Login**

```bash
# Verifique o arquivo de sessão
cat data/prosas-session.json
```

Se existir com cookies válidos = ✅ Login funcionou

### **Teste 2: Disparar Varredura Manual**

```bash
curl -X POST http://localhost:3001/api/jobs/run-weekly-scan
```

Resposta esperada:
```json
{
  "success": true,
  "estatisticas": {
    "editaisValidados": 15,
    "editaisAnalisados": 12,
    "editaisComErro": 0
  }
}
```

### **Teste 3: Ver Editais Processados**

```bash
curl http://localhost:3001/api/editais
```

Verá lista de editais já baixados do Prosas

---

## 📁 ARQUIVOS IMPORTANTES

| Arquivo | Função |
|---------|--------|
| `lib/scraper/prosas-scraper.ts` | Login + API + Busca |
| `lib/scraper/pdf-downloader.ts` | Download PDF |
| `lib/ai/analyzer.ts` | Análise IA |
| `lib/ai/validator.ts` | Validação |
| `lib/db/editais-store.ts` | Banco local |
| `data/prosas-session.json` | Sessão autenticada |
| `data/editais.json` | Todos os editais |
| `data/downloads/edital-*.pdf` | PDFs baixados |

---

## ✅ RESUMO

**O sistema REALMENTE está:**

1. ✅ Conectando ao Prosas.com.br
2. ✅ Fazendo login automaticamente
3. ✅ Buscando editais via API
4. ✅ Baixando PDFs do S3
5. ✅ Analisando com IA
6. ✅ Validando dados
7. ✅ Cadastrando no banco
8. ✅ Notificando usuário
9. ✅ Permitindo revisão manual

**Status: 🟢 TOTALMENTE OPERACIONAL**

