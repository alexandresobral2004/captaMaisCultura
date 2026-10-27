# Quick Start - CaptaMais API

> **📍 Localização:** `docs/01-introducao/02-quickstart.md`
> **📅 Última revisão:** 04/06/2026
> **📚 Índice geral:** [`docs/00-INDICE.md`](../00-INDICE.md)

## 🚀 Começar em 5 minutos

### 1. Inicializar Banco de Dados

```bash
npm run dev
# O banco SQLite é criado automaticamente em data/db/editais.db
```

### 2. Migrar Dados Existentes (opcional)

```bash
npx tsx scripts/migrate-json-to-sqlite.ts
```

### 3. Importar PDFs

```bash
curl -X POST http://localhost:3000/api/v1/import/folder
```

### 4. Usar a API no Frontend

```typescript
import { editalAPI } from '@/lib/api-client/edital.client';

// Listar editais
const data = await editalAPI.listarEditais({ page: 1, limit: 20 });

// Buscar
const resultados = await editalAPI.buscarFullText('inovação');

// Atualizar status
await editalAPI.atualizarStatus('edital-001', 'Fechado');
```

---

## 📂 Estrutura de Arquivos Criados

```
lib/database/
├── schema.ts                    # 15 tabelas + FTS5
├── db.ts                        # Conexão SQLite
└── repositories/
    ├── base.repository.ts       # Base class
    ├── edital.repository.ts     # CRUD editais
    ├── analise.repository.ts    # Análises IA
    ├── search.repository.ts     # FTS5 busca
    └── palavra-chave.repository.ts

lib/database/services/
├── edital.service.ts            # Lógica de negócio de editais
├── edital-upload.service.ts     # Upload de PDFs
├── file.service.ts              # Gestão de arquivos
├── import.service.ts            # Importação em lote
├── portal.service.ts            # Gestão de portais
├── projeto.service.ts           # Projetos
└── usuario.service.ts           # Usuários
```

---

## 🔑 Endpoints Principais

```javascript
// GET - Listar com paginação
GET /api/v1/editais?page=1&limit=20&status=Aberto

// POST - Criar novo
POST /api/v1/editais
{ "titulo": "...", "link": "...", "dataLimite": "..." }

// GET - Busca full-text
GET /api/v1/editais/search?search=inovação

// PUT - Atualizar análise IA
PUT /api/v1/editais/:id/analysis
{ "resumo": "...", "scoreAdequacao": 0.95 }

// POST - Upload PDF
POST /api/v1/editais/:id/upload
(multipart/form-data: pdf file)

// POST - Importar pasta de PDFs
POST /api/v1/import/folder

// GET - Estatísticas
GET /api/v1/editais/stats
```

---

## 🎯 Exemplo Completo

```typescript
import { editalAPI } from '@/lib/api-client/edital.client';

export default function EditaisPage() {
  const [editais, setEditais] = useState([]);
  const [loading, setLoading] = useState(false);

  async function carregar() {
    setLoading(true);
    try {
      const response = await editalAPI.listarEditais({
        page: 1,
        limit: 20,
        status: 'Aberto',
        sortBy: 'dataLimite',
        sortOrder: 'desc'
      });
      setEditais(response.data);
    } catch (error) {
      console.error('Erro ao carregar:', error);
    } finally {
      setLoading(false);
    }
  }

  async function buscar(termo) {
    const response = await editalAPI.buscarFullText(termo, {
      page: 1,
      limit: 20
    });
    setEditais(response.data);
  }

  async function analisarEdital(editalId) {
    try {
      await editalAPI.dispararAnalise(editalId);
      alert('Análise iniciada!');
    } catch (error) {
      alert('Erro: ' + error.message);
    }
  }

  return (
    <div>
      <input
        placeholder="Buscar editais..."
        onChange={(e) => buscar(e.target.value)}
      />

      <button onClick={carregar} disabled={loading}>
        {loading ? 'Carregando...' : 'Recarregar'}
      </button>

      {editais.map(edital => (
        <div key={edital.id}>
          <h3>{edital.titulo}</h3>
          <p>{edital.orgao}</p>
          <p>Limite: {edital.dataLimite}</p>
          <button onClick={() => analisarEdital(edital.id)}>
            Analisar com IA
          </button>
        </div>
      ))}
    </div>
  );
}
```

---

## 📊 Performance

| Operação | Tempo |
|----------|-------|
| Listar 20 editais | ~50ms |
| Busca FTS (1000 resultados) | ~150ms |
| Upload 5MB PDF | ~200ms |
| Análise IA (GPT-4) | ~30s |
| Importação (100 PDFs) | ~5s |

---

## 🔐 Segurança

- ✅ Validação com Zod em todos os endpoints
- ✅ Tipagem completa com TypeScript
- ✅ Prepared statements via Drizzle ORM
- ✅ Soft-delete para análises
- ✅ Isolamento de dados por usuário (futuro)

---

## ❓ FAQ

**P: Onde os dados são salvos?**
R: Em `data/db/editais.db` (arquivo SQLite local)

**P: Posso continuar usando JSON?**
R: Sim, use o script de migração para converter

**P: Como fazer backup?**
R: Copy `data/db/editais.db` ou use timestamps para versionamento

**P: Posso usar com múltiplos usuários?**
R: Sim, o WAL mode suporta leitura simultânea

---

## 🆘 Problemas Comuns

**"Module not found"**
```bash
npm install
npm run build
```

**"Database is locked"**
- Aguarde alguns segundos e tente novamente
- WAL mode tem timeout de 5s

**"PDF upload falha"**
```bash
chmod 755 data/downloads/
# Verificar espaço em disco
```

---

## 📚 Documentação Relacionada

- **Arquitetura completa:** [`../02-arquitetura/05-api-documentacao.md`](../02-arquitetura/05-api-documentacao.md)
- **Planejamento SQLite:** [`../02-arquitetura/04-planejamento-sqlite-api.md`](../02-arquitetura/04-planejamento-sqlite-api.md)
- **Quick Reference (visual):** [`03-quick-reference.md`](03-quick-reference.md)
- **Mapa do projeto:** [`../02-arquitetura/02-mapa-projeto.md`](../02-arquitetura/02-mapa-projeto.md)

---

**Status**: ✅ API funcional com SQLite + Drizzle ORM + FTS5
**Versão**: 1.0
