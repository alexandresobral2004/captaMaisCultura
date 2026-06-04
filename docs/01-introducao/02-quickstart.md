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

## 📚 Documentação Relacionada

- **Arquitetura completa:** [`../02-arquitetura/05-api-documentacao.md`](../02-arquitetura/05-api-documentacao.md)
- **Planejamento SQLite:** [`../02-arquitetura/04-planejamento-sqlite-api.md`](../02-arquitetura/04-planejamento-sqlite-api.md)
- **Quick Reference (visual):** [`03-quick-reference.md`](03-quick-reference.md)
- **Mapa do projeto:** [`../02-arquitetura/02-mapa-projeto-skill.md`](../02-arquitetura/02-mapa-projeto-skill.md)

---

**Status**: ✅ API funcional com SQLite + Drizzle ORM + FTS5
**Versão**: 1.0
