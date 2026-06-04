# Programação / Web Artifacts Builder Skill

> **📍 Localização:** `docs/07-skills/02-programacao-skill.md`
> **📅 Última revisão:** 04/06/2026
> **📚 Índice geral:** [`docs/00-INDICE.md`](../00-INDICE.md)
> **📌 Origem:** Consolidado de [`.agent/skills/programacaoSkill.md`](../../.agent/skills/programacaoSkill.md)

## Descrição

Suite de ferramentas para criar artefatos HTML elaborados e multi-componente usando tecnologias frontend modernas (React, Tailwind CSS, shadcn/ui). Use para artefatos complexos que requerem gerenciamento de estado, roteamento, ou componentes shadcn/ui - não para artefatos simples HTML/JSX de arquivo único.

## Quick Start

### 1. Inicializar Projeto

Execute o script de inicialização para criar um novo projeto React:

```bash
bash scripts/init-artifact.sh <project-name>
cd <project-name>
```

Isso cria um projeto totalmente configurado com:

- ✅ React + TypeScript (via Vite)
- ✅ Tailwind CSS 3.4.1 com sistema de temas shadcn/ui
- ✅ Path aliases (`@/`) configurados
- ✅ 40+ componentes shadcn/ui pré-instalados
- ✅ Todas as dependências Radix UI incluídas
- ✅ Parcel configurado para bundling
- ✅ Compatibilidade Node 18+ (auto-detecta e fixa versão do Vite)

### 2. Desenvolver o Artefato

Edite os arquivos gerados em `src/` para construir o componente.

### 3. Bundle em HTML Único

```bash
bash scripts/bundle-artifact.sh
```

### 4. Exibir Artefato

Abra o arquivo HTML único gerado no navegador.

### 5. (Opcional) Testar

Execute os testes do projeto.

## Stack

- **React 18** + **TypeScript**
- **Vite** (dev server)
- **Parcel** (bundling em arquivo único)
- **Tailwind CSS 3.4.1**
- **shadcn/ui** (componentes)

## Diretrizes de Design & Estilo

**MUITO IMPORTANTE**: Para evitar o que é frequentemente chamado de "AI slop", evite usar:

- ❌ Layouts centralizados em excesso
- ❌ Gradientes roxos
- ❌ Cantos arredondados uniformes
- ❌ Fonte Inter

**Prefira:**

- ✅ Composições assimétricas
- ✅ Paletas coesas com acentos
- ✅ Tipografia distinta
- ✅ Layouts com fluxo intencional

## Aplicação no Capta+

No contexto do **Capta+**, esta skill é usada para:

- ✅ Componentes de UI em React (botões, cards, modais)
- ✅ Páginas interativas (dashboard, editais, projetos)
- ✅ Componentes com estado (filtros, formulários, revisão)
- ✅ Integração com APIs REST

**Nota importante:** O Capta+ usa CSS Puro (Vanilla CSS) ao invés de Tailwind. Esta skill é útil para criar componentes isolados, mas a integração final deve seguir o padrão de Design Tokens do projeto.

---

## 📚 Documentação Relacionada

- **Frontend Design Skill:** [`01-frontend-skill.md`](01-frontend-skill.md)
- **Clean Code Skill:** [`03-clean-code-skill.md`](03-clean-code-skill.md)
- **Design System:** [`../02-arquitetura/02-mapa-projeto.md`](../02-arquitetura/02-mapa-projeto.md) (seção 11)
