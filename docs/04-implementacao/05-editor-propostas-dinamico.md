# Editor de Propostas Dinâmico e Rich-Text (Capta+ v3.2)

> **📍 Localização:** `docs/04-implementacao/05-editor-propostas-dinamico.md`  
> **📅 Última revisão:** 07/06/2026  
> **📚 Índice geral:** [`docs/00-INDICE.md`](../00-INDICE.md)  

## 📋 Resumo da Funcionalidade

Com o objetivo de flexibilizar a geração e refinamento de propostas de projetos para editais, o sistema do **Capta+** passou de um modelo estático de 7 seções rígidas para uma estrutura de **seções dinâmicas e ricas**. Isso permite aos usuários:
1. **Adicionar seções sob demanda** (ex: Público-Alvo, Impacto Ambiental, Histórico do Proponente).
2. **Remover seções desnecessárias** da proposta final.
3. **Reordenar seções** usando botões simples de subir/descer na interface de edição.
4. **Editar o conteúdo de forma visual (WYSIWYG)** usando um componente customizado de Rich-Text com suporte a negrito, itálico, sublinhado, títulos (H1, H2), listas (ordenadas e não ordenadas), alinhamento de texto e tabelas complexas.
5. **Preservar a compatibilidade retroativa**, migrando automaticamente os campos do banco de dados no modelo antigo assim que a proposta for lida ou editada pela primeira vez.
6. **Gerar PDFs limpos e estruturados** convertendo o HTML do editor em Markdown de forma precisa.

---

## 🏗️ Arquitetura das Camadas

A arquitetura do editor dinâmico envolve modificações e implementações em cinco camadas principais do sistema:

```
[ FRONTEND ] ──────► RichTextEditor (Componente UI com document.execCommand)
                    │
                    ▼
[ API ROUTE ] ────► PUT /api/v1/projetos/[id] (Validação via Zod Schema)
                    │
                    ▼
[ SERVICE ] ──────► ProjetoService (Lógica de sincronização e migração)
                    │
                    ▼
[ DATABASE ] ─────► SQLite / Drizzle ORM (Coluna projetos.secoes_dinamicas)
                    │
                    ▼
[ EXPORT ] ───────► htmlToMarkdown + buildPdf (PDFKit no Backend)
```

---

## 💾 1. Camada de Banco de Dados (`SQLite` & `Drizzle`)

Para suportar seções arbitrárias sem alterar a tabela sempre que uma seção nova for criada, foi adicionada a coluna `secoes_dinamicas` (tipo TEXT contendo um JSON serializado) à tabela `projetos`.

### Definição do Schema (`lib/database/schema.ts`)
```typescript
export const projetos = sqliteTable('projetos', {
  id: text('id').primaryKey(),
  editalId: text('edital_id').notNull().references(() => editais.id, { onDelete: 'cascade' }),
  titulo: text('titulo').notNull(),
  // ... outros campos (propostaUsuario, valorSolicitado, etc)
  
  // Coluna de seções dinâmicas adicionada na v3.2
  secoesDinamicas: text('secoes_dinamicas'), // JSON serializado de SecaoDinamica[]
  
  // Timestamps
  criadoEm: text('criado_em').default('CURRENT_TIMESTAMP'),
  atualizadoEm: text('atualizado_em').default('CURRENT_TIMESTAMP'),
});
```

### Migração de Esquema Automática (`lib/database/db.ts`)
A migração de tabelas antigas para adicionar a nova coluna ocorre na inicialização da aplicação pelo script de setup do SQLite:
```typescript
const hasSecoesDinamicas = projColumns.some((col: any) => col.name === 'secoes_dinamicas');
if (!hasSecoesDinamicas) {
  sqlite.exec(`ALTER TABLE projetos ADD COLUMN secoes_dinamicas TEXT`);
  console.log('✅ Migração: coluna secoes_dinamicas adicionada à tabela projetos');
}
```

### Tipagem da Seção Dinâmica (`SecaoDinamica`)
Cada item do array `secoesDinamicas` obedece à interface:
```typescript
interface SecaoDinamica {
  id: string;        // ID único (ex: 'justificativa' ou 'secao_1717789392000')
  chave: string;     // Chave interna para mapeamento (slug ou timestamp)
  titulo: string;    // Nome legível exibido no formulário (ex: "Justificativa")
  conteudo: string;  // Conteúdo em formato HTML rico gerado pelo editor
  ordem: number;     // Índice numérico para ordenação sequencial
  editavel: boolean; // Flag indicando se a seção pode ser removida/renomeada pelo usuário
}
```

---

## 🔄 2. Camada de Serviço e Migração de Dados (`ProjetoService`)

O `ProjetoService` em `lib/database/services/projeto.service.ts` atua como o cérebro da migração. Ele assegura compatibilidade retroativa e sincronização com chamadas antigas de IA (que gravam dados em colunas fixas do banco de dados).

### 2.1 Migração Sob Demanda (`buscarPorId`)
Quando uma proposta gerada no modelo antigo é buscada, o banco retorna colunas como `resumoExecutivo`, `justificativa`, etc. preenchidas, mas `secoesDinamicas` vazia.
O método `buscarPorId` intercepta este estado e converte as strings textuais em blocos HTML ricos, salvando-os de volta no banco:

```typescript
let secoesDinamicasList: any[] = [];
if (projeto.secoesDinamicas) {
  secoesDinamicasList = JSON.parse(projeto.secoesDinamicas);
}

if (!secoesDinamicasList || secoesDinamicasList.length === 0) {
  const defaultSecoes = [
    {
      id: 'resumoExecutivo', chave: 'resumoExecutivo', titulo: 'Resumo Executivo',
      conteudo: projeto.resumoExecutivo ? `<p>${projeto.resumoExecutivo.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>')}</p>` : '',
      ordem: 0, editavel: true
    },
    {
      id: 'justificativa', chave: 'justificativa', titulo: 'Justificativa',
      conteudo: projeto.justificativa ? `<p>${projeto.justificativa.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>')}</p>` : '',
      ordem: 1, editavel: true
    },
    {
      id: 'objetivos', chave: 'objetivos', titulo: 'Objetivos',
      conteudo: projeto.objetivos ? formatarObjetivosHTML(projeto.objetivos) : '',
      ordem: 2, editavel: true
    },
    // ... repete para metodologia, resultadosEsperados, cronograma e orcamentoDetalhado
  ];
  
  secoesDinamicasList = defaultSecoes;
  
  // Atualiza banco de dados com as seções migradas
  await this.projetoRepo.update(projeto.id, {
    secoesDinamicas: JSON.stringify(secoesDinamicasList)
  });
}
```

### 2.2 Sincronização Inteligente no Salvamento (`atualizar`)
Se um processo secundário (como o gerador IA) atualiza campos estáticos (`data.resumoExecutivo`, `data.justificativa`, etc.) sem mexer diretamente nas seções dinâmicas, o `ProjetoService.atualizar` atualiza as seções dinâmicas correspondentes para manter o banco consistente.
As funções utilitárias `formatarObjetivosHTML`, `formatarResultadosHTML` e `formatarOrcamentoHTML` detectam se os dados inseridos são JSON brutos da IA e os formatam visualmente em HTML (listas estruturadas, tabelas elegantes e listas de metas temporais) antes de injetá-los nas seções do editor.

---

## 📡 3. Validação na API (`Next.js Router`)

O endpoint v1 de projetos valida a requisição HTTP `PUT /api/v1/projetos/[id]/route.ts` usando a biblioteca `zod`:

```typescript
const atualizarProjetoSchema = z.object({
  propostaUsuario: z.string().optional(),
  valorSolicitado: z.number().optional(),
  prazoMeses: z.number().optional(),
  equipe: z.array(z.any()).optional(),
  criteriosAtendidos: z.array(z.string()).optional(),
  criteriosPendentes: z.array(z.string()).optional(),
  scoreCompliance: z.number().optional(),
  status: z.string().optional(),
  
  // Validação adicionada para a lista dinâmica de seções
  secoesDinamicas: z.union([z.array(z.any()), z.string()]).optional(),
});
```
Se `secoesDinamicas` for passado como um array de objetos, ele é serializado no banco pelo serviço.

---

## 🎨 4. Frontend Component: `RichTextEditor`

Para evitar dependências pesadas e lentas de editores externos (como Quill ou Lexical), foi desenvolvido um componente nativo baseado nas APIs de edição visual do navegador.

**Localização**: [`components/ui/rich-text-editor.tsx`](file:///Users/alexandrerocha/captaMaisCultura/components/ui/rich-text-editor.tsx)

### Recursos de Layout e Estilo:
- **Design de Vidro (Glassmorphism)**: Efeito translúcido utilizando `backdrop-blur-md` e bordas com baixa opacidade para se misturar harmoniosamente ao tema do Capta+.
- **Modo Escuro (Dark Mode)**: Cores adaptadas dinamicamente usando classes do Tailwind e estilos nativos.
- **Área de Edição Flexível**: Usa uma div com o atributo `contentEditable` nativo do HTML5, garantindo leveza e carregamento imediato.

### Ações e Comandos Suportados:
- **Formatação básica**: Negrito (`bold`), Itálico (`italic`), Sublinhado (`underline`).
- **Níveis de Título**: Formata o bloco com `<h1>` e `<h2>` para estruturar a proposta.
- **Alinhamento**: Esquerda (`justifyLeft`), Centralizado (`justifyCenter`), Direita (`justifyRight`).
- **Listas**: Bullet points (`insertUnorderedList`) e numeração (`insertOrderedList`).
- **Limpeza de formatação**: Botão para apagar tags e styles indesejados (`removeFormat`), útil ao colar dados externos.
- **Criação de Tabelas**: O editor insere um esqueleto HTML de tabela customizado no ponto do cursor utilizando `document.execCommand('insertHTML', tableHTML)`. A tabela possui bordas suaves (`#e2e8f0`), cabeçalhos contrastantes e padding interno apropriado para digitação.

### Sincronização e Prevenção de Saltos do Cursor:
Para evitar que o cursor (caret) salte para o início do campo quando o estado é atualizado no React, o editor compara o HTML interno com o valor externo recebido e somente atualiza o DOM quando há discrepâncias reais:
```typescript
useEffect(() => {
  if (editorRef.current) {
    if (editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '<p><br></p>';
    }
  }
}, [value]);
```

---

## 📤 5. Exportador PDF e Markdown

A exportação da proposta gerada converte as seções dinâmicas em formatos finais suportados.

**Localização**: [`app/projetos/[id]/export/route.ts`](file:///Users/alexandrerocha/captaMaisCultura/app/projetos/[id]/export/route.ts)

### 5.1 Conversão HTML para Markdown (`htmlToMarkdown`)
Como a exportação para PDF usa um parser de texto baseado em Markdown simples, foi escrita uma função de renderização sintática para converter as tags HTML geradas pelo `RichTextEditor` de volta em marcações válidas do Markdown:

```typescript
function htmlToMarkdown(html: string): string {
  if (!html) return '';
  let md = html;

  // Cabeçalhos
  md = md.replace(/<h1>(.*?)<\/h1>/gi, '# $1\n\n');
  md = md.replace(/<h2>(.*?)<\/h2>/gi, '## $1\n\n');
  md = md.replace(/<h3>(.*?)<\/h3>/gi, '### $1\n\n');

  // Tabelas HTML para Tabelas Markdown
  md = md.replace(/<table[^>]*>/gi, '\n');
  md = md.replace(/<\/table>/gi, '\n');
  md = md.replace(/<thead[^>]*>/gi, '');
  md = md.replace(/<\/thead>/gi, '');
  md = md.replace(/<tbody[^>]*>/gi, '');
  md = md.replace(/<\/tbody>/gi, '');
  md = md.replace(/<tr[^>]*>/gi, '');
  md = md.replace(/<\/tr>/gi, '|\n');
  md = md.replace(/<th[^>]*>(.*?)<\/th>/gi, '| **$1** ');
  md = md.replace(/<td[^>]*>(.*?)<\/td>/gi, '| $1 ');

  // Estilos de texto
  md = md.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<b>(.*?)<\/b>/gi, '**$1**');
  md = md.replace(/<em>(.*?)<\/em>/gi, '*$1*');
  md = md.replace(/<i>(.*?)<\/i>/gi, '*$1*');
  md = md.replace(/<u>(.*?)<\/u>/gi, '_$1_');

  // Listas
  md = md.replace(/<ul[^>]*>/gi, '\n');
  md = md.replace(/<\/ul>/gi, '\n');
  md = md.replace(/<ol[^>]*>/gi, '\n');
  md = md.replace(/<\/ol>/gi, '\n');
  md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');

  // Parágrafos e quebras de linha
  md = md.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');
  md = md.replace(/<br\s*\/?>/gi, '\n');

  // Remove quaisquer outras tags HTML residuais
  md = md.replace(/<[^>]+>/g, '');

  // Decodifica entidades HTML básicas (&nbsp;, &amp;, etc)
  md = md.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');

  return md.trim();
}
```

### 5.2 Geração de PDF via PDFKit (`buildPdf`)
O gerador de PDF lê as linhas convertidas do Markdown e aplica os estilos do PDFKit de forma fluida. O interpretador foi atualizado na v3.2 para suportar novos elementos como sub-títulos menores (`####`), delimitadores horizontais e renderização limpa de bullets com círculos (`•`), garantindo uma saída visualmente profissional sem poluição de tags HTML.
