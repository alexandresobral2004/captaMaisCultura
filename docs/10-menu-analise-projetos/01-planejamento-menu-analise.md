# Planejamento: Menu de Análise de Projetos Científicos

## 1. Introdução e Contexto

Este documento apresenta o planejamento completo para criação de um **novo módulo INDEPENDENTE** no sistema Capta+ Cultura, dedicado exclusivamente à **análise e elaboração de projetos científicos** para submissão em editais de pesquisa e financiamento científico.

### 1.1 Objetivo Principal

Criar um sistema **COMPLETAMENTE SEPARADO** que permita aos pesquisadores:
- Analisar a adequação de seus projetos a editais científicos específicos
- Gerar propostas completas seguindo padrões acadêmicos (CNPq, CAPES, FAPESP, FINEP)
- Receber feedback automatizado sobre compliance com critérios do edital
- Acompanhar o status de seus projetos através de um workflow estruturado

### 1.2 PRINCÍPIO FUNDAMENTAL: INDEPENDÊNCIA TOTAL

⚠️ **NÃO HAVERÁ MODIFICAÇÃO NO SISTEMA EXISTENTE DE CULTURA/EDITAIS**

O novo módulo será uma **CÓPIA INDEPENDENTE** do sistema atual, com as seguintes características:
- **Estrutura de diretórios própria**: `app/analise-cientifica/` (separado de `app/editais/` e `app/projetos/`)
- **APIs próprias**: `/api/analise-cientifica/` (separado de `/api/v1/editais/` e `/api/v1/projetos/`)
- **Banco de dados próprio**: Tabelas com prefixo `analise_cientifica_` (ex: `analise_cientifica_projetos`)
- **Schemas de IA próprios**: Prompts e validações específicas para projetos científicos
- **Interface completamente separada**: Menu próprio na sidebar, sem compartilhamento de componentes de negócio

### 1.3 O que será REUTILIZADO (apenas componentes visuais)

Apenas componentes UI genéricos poderão ser compartilhados:
- [`Button`](components/ui/button.tsx)
- [`Card`](components/ui/card.tsx)
- [`Badge`](components/ui/badge.tsx)
- [`Input`](components/ui/input.tsx)
- [`Textarea`](components/ui/textarea.tsx)
- [`Spinner`](components/ui/spinner.tsx)
- [`Toast`](components/ui/toast.tsx)

**NÃO SERÃO REUTILIZADOS:**
- ❌ Lógica de editais culturais
- ❌ Schemas de projetos de cultura
- ❌ Prompts de geração de projetos culturais
- ❌ APIs de editais existentes
- ❌ Páginas do sistema atual

---

## 2. Referências: Projetos Científicos Bem Elaborados

### 2.1 Estrutura Padrão de um Projeto Científico

Um projeto científico bem elaborado para submissão em editais deve conter as seguintes seções fundamentais:

| Seção | Descrição | Peso na Avaliação |
|-------|-----------|-------------------|
| **Título** | Claro, objetivo, contendo palavras-chave | 5% |
| **Resumo Executivo** | Síntese do projeto (250-500 palavras) | 10% |
| **Justificativa** | Contextualização do problema e relevância | 15% |
| **Objetivos** | Geral e específicos, mensuráveis | 15% |
| **Metodologia** | Procedimentos técnicos e científicos | 20% |
| **Resultados Esperados** | Impacto previsto em diferentes horizontes temporais | 10% |
| **Orçamento** | Detalhamento de custos com justificativa | 10% |
| **Cronograma** | Plano de execução em etapas | 5% |
| **Equipe** | Qualificação e dedicação dos pesquisadores | 10% |

### 2.2 Fontes de Referência Consultadas

#### CNPq - Conselho Nacional de Desenvolvimento Científico e Tecnológico
- Diretrizes para elaboração de projetos de pesquisa
- Critérios de avaliação por área do conhecimento
- Modelos de formulários para diferentes modalidades de fomento

#### CAPES - Coordenação de Aperfeiçoamento de Pessoal de Nível Superior
- Normas para projetos de pesquisa acadêmica
- Critérios de avaliação de projetos multicêntricos
- Padrões de qualidade para propostas de mestrado e doutorado

#### FAPESP - Fundação de Amparo à Pesquisa do Estado de São Paulo
- Manual de elaboração de projetos de pesquisa
- Critérios de elegibilidade e mérito
- Estrutura de orçamento detalhado

#### FINEP - Financiadora de Estudos e Projetos
- Modelo de projeto para subvenção econômica
- Critérios de inovação e impacto
- Padrões de formulação para projetos de desenvolvimento tecnológico

### 2.3 Melhores Práticas Identificadas

1. **Clareza na Formulação**: Objetivos específicos devem ser SMART (Específicos, Mensuráveis, Alcançáveis, Relevantes, Temporais)

2. **Alinhamento com o Edital**: Cada seção deve demonstrar explicitamente como atende aos critérios de avaliação

3. **Fundamentação Teórica**: Referências bibliográficas atualizadas e relevantes

4. **Viabilidade Demonstrada**: Cronograma e orçamento realistas

5. **Impacto Social**: Demonstração de retorno para a sociedade

6. **Inovação**: Diferenciação em relação a pesquisas existentes

---

## 3. Recursos do Sistema Atual (SOMENTE REFERÊNCIA)

⚠️ **IMPORTANTE**: Estes recursos existem no sistema de CULTURA e NÃO devem ser modificados. O novo sistema será uma **CÓPIA INDEPENDENTE**.

### 3.1 Componentes UI Genéricos (Podem ser reutilizados visualmente)

Estes são componentes visuais genéricos que podem ser usados no novo sistema:

| Componente | Localização | Uso no Novo Sistema |
|------------|-------------|-------------------|
| [`RichTextEditor`](components/ui/rich-text-editor.tsx) | `components/ui/` | Editor para seções do projeto |
| [`Card`](components/ui/card.tsx) | `components/ui/` | Container para seções |
| [`Badge`](components/ui/badge.tsx) | `components/ui/` | Status e tags |
| [`Button`](components/ui/button.tsx) | `components/ui/` | Ações principais |
| [`Input`](components/ui/input.tsx) | `components/ui/` | Formulários |
| [`Textarea`](components/ui/textarea.tsx) | `components/ui/` | Campos de texto longo |
| [`Spinner`](components/ui/spinner.tsx) | `components/ui/` | Feedback de carregamento |
| [`Toast`](components/ui/toast.tsx) | `components/ui/` | Notificações |

### 3.2 Serviços de IA (CRIAÇÃO DE CÓPIAS INDEPENDENTES)

Estes arquivos serão **COPIADOS e adaptados** para o novo sistema:

| Arquivo Original | Será Copiado Para | Descrição |
|-----------------|-------------------|-----------|
| [`lib/ai/writer.ts`](lib/ai/writer.ts) | `lib/analise-cientifica/writer.ts` | Gerador de propostas científicas |
| [`lib/ai/prompts-projeto.ts`](lib/ai/prompts-projeto.ts) | `lib/analise-cientifica/prompts.ts` | Prompts especializados |
| [`lib/ai/schema-projeto.ts`](lib/ai/schema-projeto.ts) | `lib/analise-cientifica/schema.ts` | Schema de validação |

### 3.3 Páginas (REFERÊNCIA APENAS - NÃO MODIFICAR)

Estas páginas existem no sistema de CULTURA e servem apenas como referência visual:

| Página Original | Localização | O que Inspirar |
|----------------|-------------|----------------|
| [`projetos/page.tsx`](app/projetos/page.tsx) | `app/projetos/` | Layout de listagem |
| [`projetos/[id]/page.tsx`](app/projetos/[id]/page.tsx) | `app/projetos/` | Editor de seções |
| [`editais/page.tsx`](app/editais/page.tsx) | `app/editais/` | Análise de adequação |

### 3.4 APIs (CRIAÇÃO DE NOVOS ENDPOINTS INDEPENDENTES)

Novos endpoints serão criados em `/api/analise-cientifica/`:

| Novo Endpoint | Funcionalidade |
|--------------|----------------|
| `/api/analise-cientifica/projetos` | CRUD de projetos científicos |
| `/api/analise-cientifica/projetos/[id]/gerar` | Geração via IA |
| `/api/analise-cientifica/editais` | Busca de editais científicos |
| `/api/analise-cientifica/analise` | Análise de conformidade |

---

## 4. Estrutura do Novo Menu (INDEPENDENTE)

### 4.1 Navegação (Sidebar)

```
Análise Científica
├── Dashboard
│   ├── Visão Geral
│   ├── Projetos Recentes
│   └── Alertas de Prazos
├── Meus Projetos
│   ├── Lista de Projetos
│   ├── Novo Projeto
│   └── Histórico
├── Editais Científicos
│   ├── Buscar Editais
│   ├── Análise de Adequação
│   └── Favoritos
├── Análise
│   ├── Verificar Conformidade
│   ├── Feedback da IA
│   └── Relatório de Compliance
└── Configurações
    ├── Modelos de Projeto
    ├── Áreas Temáticas
    └── Preferências
```

### 4.2 Estrutura de Páginas (COMPLETAMENTE SEPARADA)

```
app/
├── analise-cientifica/                    # NOVO MÓDULO INDEPENDENTE
│   ├── page.tsx                          # Dashboard principal
│   ├── layout.tsx                        # Layout próprio
│   ├── projetos/
│   │   ├── page.tsx                      # Lista de projetos científicos
│   │   ├── novo/
│   │   │   └── page.tsx                  # Criar novo projeto científico
│   │   └── [id]/
│   │       ├── page.tsx                  # Editor de projeto científico
│   │       ├── analise/
│   │       │   └── page.tsx              # Análise de conformidade
│   │       └── exportar/
│   │           └── page.tsx              # Exportar projeto
│   ├── editais/
│   │   ├── page.tsx                      # Buscar editais científicos
│   │   └── [id]/
│   │       └── adequacao/
│   │           └── page.tsx              # Análise de adequação
│   └── configuracoes/
│       ├── page.tsx                      # Configurações gerais
│       └── modelos/
│           └── page.tsx                  # Gerenciar modelos
```

---

## 5. Passo a Passo para Implementação

### Fase 1: Infraestrutura Base (Semana 1-2)

#### 1.1 Criar Rotas e Estrutura de Diretórios
```bash
# Criar estrutura de diretórios COMPLETAMENTE NOVA
mkdir -p app/analise-cientifica/{projetos/{novo,[id]/{analise,exportar}},editais/[id]/adequacao,configuracoes/modelos}
```

#### 1.2 Atualizar Sidebar
- Adicionar novo item de menu "Análise Científica" (separado do menu de cultura)
- Configurar ícones e submenus próprios
- Implementar navegação expansível

#### 1.3 Criar Layout Base
- Criar `analise-cientifica/layout.tsx` (NÃO modificar o layout existente)
- Definir estrutura de breadcrumbs própria
- Implementar contexto de navegação independente

### Fase 2: Componentes de Interface (Semana 2-3)

#### 2.1 Componentes Específicos do Novo Sistema
- `ProjetoCientificoCard.tsx` - Card para listagem de projetos científicos
- `SecaoEditor.tsx` - Editor para cada seção do projeto
- `IndicadorProgresso.tsx` - Barra de progresso de completude
- `FeedbackCard.tsx` - Card para exibir feedback da IA
- `ComplianceBadge.tsx` - Badge de status de conformidade

#### 2.2 Componentes UI Genéricos (Reutilizáveis)
- Reutilizar `RichTextEditor` para edição de seções
- Reutilizar `Card` para containers
- Reutilizar `Badge` para status
- Reutilizar `Button` para ações

### Fase 3: Lógica de Negócio (Semana 3-4)

#### 3.1 Serviços de Análise (NOVOS ARQUIVOS)
- `lib/analise-cientifica/analise-service.ts` - Serviço para análise de conformidade
- `lib/analise-cientifica/projeto-service.ts` - Serviço para gerenciamento de projetos
- `lib/analise-cientifica/feedback-service.ts` - Serviço para geração de feedback

#### 3.2 Schemas de Validação (NOVOS ARQUIVOS)
- `lib/analise-cientifica/schema.ts` - Schema para projetos científicos
- `lib/analise-cientifica/schema-analise.ts` - Schema para análise de conformidade

#### 3.3 Prompts Especializados (NOVOS ARQUIVOS)
- `lib/analise-cientifica/prompts.ts` - Prompts para análise e geração
- `lib/analise-cientifica/writer.ts` - Escritor de propostas científicas

### Fase 4: APIs (Semana 4-5)

#### 4.1 Endpoints de Projetos Científicos (NOVOS ENDPOINTS)
```
POST   /api/analise-cientifica/projetos              # Criar projeto
GET    /api/analise-cientifica/projetos              # Listar projetos
GET    /api/analise-cientifica/projetos/[id]        # Buscar projeto
PUT    /api/analise-cientifica/projetos/[id]        # Atualizar projeto
DELETE /api/analise-cientifica/projetos/[id]        # Deletar projeto
POST   /api/analise-cientifica/projetos/[id]/gerar  # Gerar proposta
POST   /api/analise-cientifica/projetos/[id]/analisar # Analisar conformidade
```

#### 4.2 Endpoints de Análise (NOVOS ENDPOINTS)
```
POST   /api/analise-cientifica/analise/adequacao     # Analisar adequação a edital
POST   /api/analise-cientifica/analise/compliance   # Verificar compliance
GET    /api/analise-cientifica/analise/feedback/[id] # Obter feedback
```

### Fase 5: Interface do Usuário (Semana 5-6)

#### 5.1 Dashboard
- Cards de resumo (projetos, editais, prazos)
- Gráficos de status
- Alertas de prazos próximos

#### 5.2 Editor de Projeto
- Lista de seções com editor rico
- Indicador de completude por seção
- Preview da proposta completa
- Botão de geração assistida por IA

#### 5.3 Análise de Conformidade
- Checklist de critérios do edital
- Score de adequação
- Feedback detalhado por seção
- Sugestões de melhoria

### Fase 6: Integração e Testes (Semana 6-7)

#### 6.1 Testes de Integração
- Testar fluxo completo: criação → edição → análise → exportação
- Testar integração com editais existentes
- Testar geração de feedback

#### 6.2 Testes de Usabilidade
- Validar fluxos com usuários reais
- Ajustar interface baseado em feedback

---

## 6. Especificações Técnicas Detalhadas

### 6.1 Schema de Dados

```typescript
// Projeto Científico
interface ProjetoCientifico {
  id: string;
  titulo: string;
  areaTematica: string;
  nivel: 'iniciacao' | 'mestrado' | 'doutorado' | 'pos-doutorado' | 'pesquisador';
  status: 'rascunho' | 'em_analise' | 'submetido' | 'aprovado' | 'reprovado';
  
  // Seções do Projeto
  resumoExecutivo: string;
  justificativa: string;
  objetivoGeral: string;
  objetivosEspecificos: ObjetivoEspecifico[];
  metodologia: string;
  resultadosEsperados: ResultadosEsperados;
  orcamento: OrcamentoDetalhado;
  cronograma: CronogramaEtapa[];
  equipe: MembroEquipe[];
  
  // Metadados
  editalId?: string;
  palavrasChave: string[];
  dataCriacao: Date;
  dataAtualizacao: Date;
  versao: number;
  
  // Análise
  analise?: AnaliseConformidade;
  scoreCompliance?: number;
}

// Análise de Conformidade
interface AnaliseConformidade {
  criteriosAvaliados: CriterioAvaliado[];
  scoreGeral: number;
  feedback: FeedbackSecao[];
  recomendacoes: string[];
  dataAnalise: Date;
}

// Criterio Avaliado
interface CriterioAvaliado {
  criterio: string;
  peso: number;
  pontuacao: number;
  atendido: boolean;
  comentario: string;
  sugestao?: string;
}
```

### 6.2 Critérios de Avaliação por Área

| Área | Critérios Principais |
|------|---------------------|
| **Ciências Exatas** | Metodologia técnica, inovação, viabilidade |
| **Ciências Biológicas** | Impacto ambiental, ética, aplicabilidade |
| **Ciências Humanas** | Fundamentação teórica, relevância social |
| **Engenharias** | Prototipagem, escalabilidade, resultados mensuráveis |
| **Ciências da Saúde** | Ensaios clínicos, ética, impacto na saúde pública |

### 6.3 Integrações Necessárias (NOVAS APIS INDEPENDENTES)

| Integração | Propósito |
|------------|-----------|
| **OpenAI API** | Geração de propostas e feedback |
| **Tavily MCP** | Busca de referências e fundamentação |
| **RAG System** | Recuperação de modelos e templates |
| **Edital Científico API** | Busca de editais científicos (NOVA API INDEPENDENTE) |

---

## 7. Regras de Negócio

### 7.1 Validações de Projeto

1. **Título**: Mínimo 20 caracteres, máximo 300
2. **Resumo**: Mínimo 250 palavras, máximo 500
3. **Objetivos**: Mínimo 2 objetivos específicos
4. **Metodologia**: Mínimo 300 palavras
5. **Orçamento**: Deve estar dentro do limite do edital
6. **Equipe**: Mínimo 2 membros (exceto iniciação científica)

### 7.2 Critérios de Compliance

Um projeto é considerado **compliant** quando:
- Score geral ≥ 70%
- Todos os critérios obrigatórios atendidos
- Nenhuma seção com score < 50%

### 7.3 Status do Projeto

| Status | Descrição | Transições Permitidas |
|--------|-----------|----------------------|
| `rascunho` | Projeto em elaboração | → `em_analise` |
| `em_analise` | Em análise de conformidade | → `rascunho`, → `submetido` |
| `submetido` | Submetido ao edital | → `aprovado`, → `reprovado` |
| `aprovado` | Aprovado no edital | (terminal) |
| `reprovado` | Não aprovado | → `rascunho` (revisão) |

---

## 8. Fluxo do Usuário

### 8.1 Fluxo Principal

```
1. Usuário acessa "Análise de Projetos"
   ↓
2. Dashboard exibe resumo e alertas
   ↓
3. Usuário cria novo projeto ou seleciona existente
   ↓
4. Editor exibe seções do projeto
   ↓
5. Usuário preenche/edita seções
   ↓
6. Sistema calcula completude em tempo real
   ↓
7. Usuário solicita análise de conformidade
   ↓
8. Sistema verifica compliance com edital
   ↓
9. Feedback da IA é exibido
   ↓
10. Usuário exporta projeto finalizado
```

### 8.2 Fluxo de Análise

```
1. Usuário seleciona projeto
   ↓
2. Usuário seleciona edital de referência
   ↓
3. Sistema extrai critérios do edital
   ↓
4. Sistema avalia cada seção do projeto
   ↓
5. Sistema gera pontuação por critério
   ↓
6. Sistema gera feedback detalhado
   ↓
7. Sistema exibe relatório de compliance
   ↓
8. Usuário pode solicitar melhorias específicas
```

---

## 9. Estimativa de Esforço

| Fase | Atividade | Estimativa |
|------|-----------|------------|
| 1 | Infraestrutura Base | 16 horas |
| 2 | Componentes de Interface | 24 horas |
| 3 | Lógica de Negócio | 32 horas |
| 4 | APIs | 24 horas |
| 5 | Interface do Usuário | 40 horas |
| 6 | Integração e Testes | 24 horas |
| **Total** | | **160 horas** |

---

## 10. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Complexidade excessiva na adaptação de componentes | Média | Alto | Criar camada de abstração antes da adaptação |
| Atrasos em integrações de IA | Alta | Alto | Implementar fallback para geração básica |
| Mudanças nos critérios de editais | Média | Médio | Criar sistema flexível de critérios |
| Performance com projetos grandes | Baixa | Alto | Implementar paginação e lazy loading |

---

## 11. Próximos Passos

1. **Aprovar este planejamento** - Revisar e validar estrutura proposta
2. **Criar protótipo de baixa fidelidade** - Wireframes das telas principais
3. **Definir prioridades de implementação** - Selecionar funcionalidades mínimas viáveis
4. **Iniciar Fase 1** - Começar pela infraestrutura base
5. **Revisar semanalmente** - Ajustar plano baseado no progresso

---

*Documento criado em: 2026-06-07*
*Versão: 1.0*
*Autor: Sistema Capta+ Cultura*
