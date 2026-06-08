# Editor Científico Avançado com IA e Editor Rico (Capta+ v3.3)

> **📍 Localização:** `docs/04-implementacao/06-editor-cientifico-avancado.md`  
> **📅 Última revisão:** 07/06/2026  
> **📚 Índice geral:** [`docs/00-INDICE.md`](../00-INDICE.md)  

---

## 📋 Resumo da Funcionalidade

Para atender a demandas de pesquisa de alto nível acadêmico e facilitar a conformidade com editais de órgãos de fomento (CNPq, CAPES, FINEP, FAPs), o módulo de **Análise Científica** do **Capta+** foi expandido para um modelo de **Editor Científico Avançado com IA e Editor Rico**.

Esta funcionalidade provê:
1. **Escrita Científica Grounded (Busca Web Real):** O gerador de propostas utiliza a busca web do Tavily para obter evidências científicas reais, dados estatísticos recentes e gerar referências bibliográficas automáticas no formato ABNT.
2. **Qualidade Acadêmica Sênior (Anti-Clichês):** Regras restritas de filtragem de linguagem impedem o uso de redundâncias, superlativos e clichês gerados por Inteligência Artificial (ex: "jornada", "crucial", "em resumo").
3. **Editor de Texto Rico (WYSIWYG Customizado):** Componente `RichTextEditor` leve e nativo com suporte a parágrafos, cabeçalhos, negrito, itálico, recuo/recuo negativo de texto e inserção de tabelas HTML.
4. **Gerenciamento de Seções Dinâmicas:** Capacidade de criar seções personalizadas, renomear qualquer seção inline, excluir seções customizadas e reordenar seções (Subir/Descer) refletindo imediatamente no banco de dados e no PDF.
5. **Capa e Cadastro de Proponentes:** Formulário dinâmico para cadastrar pesquisadores (Nome, CPF, Titulação, Vínculo, Função, Lattes) com renderização profissional formatada na capa do projeto.
6. **Resultados Esperados Simplificados:** Transição do antigo modelo estruturado em JSON para texto corrido aprofundado, eliminando falhas de validação de tipo.
7. **Espaçamento e Divisores no PDF:** Linhas finas sob títulos e espaçamento rígido de 3cm (85pt) entre as seções no PDF gerado via PDFKit.

---

## 🏗️ Arquitetura das Camadas

O ecossistema do editor científico avançado opera de maneira totalmente isolada do fluxo cultural tradicional, utilizando as seguintes camadas estruturais:

```
[ FRONTEND ] ────────► Editor CientíficoPage (page.tsx / Abas: Conteúdo e Proponentes)
                        │
                        ├─► RichTextEditor (Comando nativo e tabelas)
                        └─► Reordenação e Inline Title Editing
                                │
                                ▼
[ API ENDPOINTS ] ───► POST /api/analise-cientifica/projetos/[id]/gerar (Tavily + GPT-4o)
                     ► POST /api/analise-cientifica/projetos/[id]/gerar-completo (Tavily + GPT-4o)
                     ► PUT /api/analise-cientifica/projetos/[id] (Persistência)
                     ► GET /api/analise-cientifica/projetos/[id]/exportar (PDFKit Exporter)
                                │
                                ▼
[ IA & PESQUISA ] ───► ProposalWriterCientifico (GPT-4o + Tavily Search API)
                     ► Prompts Acadêmicos (Regras ABNT & Lista de Clichês Proibidos)
                                │
                                ▼
[ DATA & SCHEMAS ] ──► projetoCientificoSchema (Zod Schema)
                     ► DB Mock / Persistência (Retrocompatibilidade de campos estáticos)
```

---

## 💾 1. Camada de Dados e Schemas (`lib/analise-cientifica/schema.ts`)

O Zod Schema do projeto científico foi atualizado para conter novas colunas dinâmicas, mantendo a compatibilidade retroativa com campos antigos através de mapeamento automático.

### Campos Adicionados no Schema
* `secoesDinamicas`: `z.string().optional().default('[]')` (Lista serializada de seções contendo `id`, `chave`, `titulo`, `conteudo` em HTML, `completa`, `editavel` e `ordem`).
* `pesquisadoresProponentes`: `z.string().optional().default('[]')` (Lista serializada de proponentes contendo `nome`, `cpf`, `titulacao`, `vinculo`, `funcao` e `lattes`).
* `referencias`: `z.string().optional().default('')` (Campo de texto corrido contendo a bibliografia gerada no padrão ABNT).
* `titulosPersonalizados`: `z.string().optional().default('{}')` (Mapa de customizações de título para compatibilidade).

### Mapeamento e Retrocompatibilidade (Criação/Leitura)
Ao buscar ou instanciar um projeto científico, a aplicação executa a função `parseProjeto` para garantir que projetos antigos que não possuam o campo `secoesDinamicas` preenchido tenham suas seções migradas e ordenadas sequencialmente a partir dos campos estáticos:

```typescript
if (secoesList.length === 0) {
  secoesList = [
    { id: 'resumo', chave: 'resumo', titulo: 'Resumo Executivo', conteudo: proj.resumoExecutivo || '', completa: !!proj.resumoExecutivo, editavel: true, ordem: 0 },
    { id: 'justificativa', chave: 'justificativa', titulo: 'Justificativa', conteudo: proj.justificativa || '', completa: !!proj.justificativa, editavel: true, ordem: 1 },
    { id: 'objetivos', chave: 'objetivos', titulo: 'Objetivos', conteudo: '', completa: true, editavel: true, ordem: 2 },
    { id: 'metodologia', chave: 'metodologia', titulo: 'Metodologia', conteudo: proj.metodologia || '', completa: !!proj.metodologia, editavel: true, ordem: 3 },
    { id: 'resultados', chave: 'resultados', titulo: 'Resultados Esperados', conteudo: proj.resultadosEsperados || '', completa: !!proj.resultadosEsperados, editavel: true, ordem: 4 },
    { id: 'referencias', chave: 'referencias', titulo: 'Referências Bibliográficas (ABNT)', conteudo: proj.referencias || '', completa: !!proj.referencias, editavel: true, ordem: 5 }
  ];
}
```

No salvamento (`PUT`), as seções dinâmicas são convertidas de volta e sincronizadas nos campos estáticos (`resumoExecutivo`, `justificativa`, `metodologia`, `resultadosEsperados`, `referencias`), garantindo que outros microsserviços legados que consultam diretamente essas colunas continuem funcionando sem alterações.

---

## 🔍 2. Mecanismo de IA Grounded & Qualidade Acadêmica

Para atingir profundidade acadêmica sênior na escrita do projeto, o fluxo de geração de IA passou a contar com busca na web ativa e regras estritas de linguagem.

### 2.1 Integração Tavily Search (`tavily-mcp.client.ts`)
Antes de invocar o modelo GPT-4o para a elaboração completa ou parcial, a API efetua uma busca web utilizando o título do projeto e a área temática para obter artigos científicos e publicações recentes. Os resultados incluem:
* `title`: Título do artigo ou página.
* `url`: Link para a fonte original (utilizado para compor a bibliografia ABNT).
* `content`: Trecho/resumo contendo as informações de fundamentação teórica.

### 2.2 Controle de Clichês e Sentenças de IA
O arquivo `prompts.ts` contém arrays de strings que definem palavras proibidas (`PROIBIDOS`) e estruturas de frases comumente geradas por modelos de linguagem (`PADROES_IA`).
O modelo de IA recebe estas instruções de forma imperativa:

```typescript
const PROIBIDOS = [
  'mergulhe', 'jornada', 'desvendar', 'em resumo', 'em conclusao',
  'crucial', 'imperativo', 'notavel', 'tesouro', 'ademais', 'alavancar',
  'sinergia', 'catalisador', 'no cerne', 'vale ressaltar', 'cabe destacar',
  'imprescindivel', 'revolucionario', 'transformador', 'extremamente'
];

const PADROES_IA = [
  'é importante destacar que', 'no contexto atual da sociedade',
  'face aos desafios contemporâneos', 'no cenário globalizado',
  'os resultados obtidos demonstram que', 'os dados coletados evidenciam'
];
```

Qualquer ocorrência dessas expressões invalida as diretrizes de escrita científica exigidas, garantindo um texto de alta seriedade acadêmica.

---

## 🎨 3. Frontend & Componentes de Interface

A interface de edição de projetos científicos em `app/analise-cientifica/projetos/[id]/page.tsx` foi reformulada para suportar a dinâmica de seções ricas.

### 3.1 Custom RichTextEditor (`components/ui/rich-text-editor.tsx`)
Um editor WYSIWYG nativo e leve foi construído com base na API de edição visual do navegador, evitando bibliotecas pesadas e mantendo a harmonia visual (Glassmorphism e Dark Mode).
* **Funcionalidades da Barra de Ferramentas:**
  * Estilos de Fonte: Negrito, Itálico, Sublinhado.
  * Formatação de Bloco: Parágrafo, Título 2 (`<h2>`), Título 3 (`<h3>`).
  * Tamanho da Fonte: Pequeno, Médio, Grande.
  * Alinhamento: Esquerda (`justifyLeft`), Centralizado (`justifyCenter`), Direita (`justifyRight`) e Justificado (`justifyFull`).
  * Recuo de Bloco: Aumentar Recuo (`indent`) e Diminuir Recuo (`outdent`).
  * Listas: Marcadores (Unordered) e Numeração (Ordered).
  * Tabelas: Botão que insere uma tabela HTML estruturada com bordas e cabeçalhos no ponto exato do cursor do usuário.
  * Limpeza de Formatação: Remove estilizações ao colar conteúdos copiados externamente.

### 3.2 Gerenciamento Dinâmico de Seções
* **Edição de Título Inline:** O usuário pode clicar diretamente no cabeçalho de qualquer seção e renomeá-la. O valor é sincronizado dinamicamente no objeto correspondente do array `secoesDinamicas`.
* **Reordenação (Subir/Descer):** Cada seção possui botões rápidos de setas para cima/baixo que invocam `handleMoveUp` e `handleMoveDown`, redefinindo a propriedade `ordem` e atualizando a interface.
* **Adicionar Seção Personalizada:** Insere uma nova seção em branco no final da lista com o editor rico habilitado, permitindo total customização do projeto científico.
* **Remoção de Seção:** Exclui seções personalizadas criadas pelo usuário (seções padrão não podem ser removidas para manter a conformidade mínima com o edital).

### 3.3 Cadastro de Pesquisadores Proponentes
Uma aba dedicada "Proponentes" exibe uma tabela de pesquisadores que fazem parte da autoria do projeto científico. O formulário permite cadastrar:
* Nome Completo.
* CPF (formatado).
* Titulação acadêmica (Iniciação, Especialização, Mestrado, Doutorado, Pós-Doutorado).
* Vínculo Institucional (Universidade ou Instituto de pesquisa).
* Função no Projeto (Coordenador, Subcoordenador, Pesquisador, Bolsista, Técnico).
* Link do Currículo Lattes.

Os dados são salvos como uma string JSON e renderizados na capa do PDF final.

---

## 📤 4. Exportação de PDF Científico (`/api/analise-cientifica/projetos/[id]/exportar`)

A rota de exportação compila todos os dados inseridos e gera um arquivo PDF estruturado de acordo com o padrão acadêmico brasileiro usando a biblioteca **PDFKit**.

### 4.1 Capa Acadêmica
A primeira página do PDF atua como capa do projeto e exibe centralizadamente:
1. **Título do Projeto:** Em caixa alta e negrito (`fontSize: 24`, cor azul escuro `#1e1b4b`).
2. **Subtítulo:** "PROPOSTA DE PROJETO CIENTÍFICO".
3. **Metadados:** Área Temática e Nível Acadêmico do projeto.
4. **Lista de Proponentes:** Centralizada no terço inferior, exibindo em negrito o nome do pesquisador e sua respectiva função, titulação e vínculo institucional.

### 4.2 Espaçamento entre Seções (Regra dos 3cm)
Na renderização de conteúdo acadêmico, o exportador itera as seções na ordem exata definida em `secoesDinamicas`.
* **Espaço de 3cm:** Um espaçamento exato de 3cm (85 pontos no PDFKit) é aplicado entre as seções.
* **Quebra de Página Automática:** Se o espaço remanescente na página for menor que o necessário para exibir o título e o início do conteúdo, o PDFKit executa `doc.addPage()` para evitar quebras órfãs.
* **Títulos e Divisores:** Cada seção é iniciada com seu título customizado em azul e uma **linha horizontal vermelha (#dc2626)** com espessura de 1pt logo abaixo para delimitação visual.

### 4.3 Conversão HTML para Estilos PDFKit (`htmlToMarkdown`)
A função `htmlToMarkdown` parseia a estrutura HTML gerada pelo `RichTextEditor` no banco de dados e a converte em estilos markdown básicos compreendidos pelo gerador de PDF:
* **Preservação de Alinhamento:** Tags `<p style="text-align: ...">` são mapeadas utilizando um comentário de alinhamento (`<!-- align:left|center|right|justify -->`). O renderizador PDFKit extrai este marcador no início do parágrafo e o aplica dinamicamente na renderização do bloco.
* **Tabelas HTML:** As tags `<table>`, `<tr>`, `<td>`, `<th>` são extraídas e convertidas em uma tabela markdown baseada em pipes (`|`). O exportador detecta a sintaxe de pipes e desenha uma tabela real usando o método `renderTableRow` do PDFKit, atribuindo larguras de colunas proporcionais, fundo contrastante no cabeçalho e bordas de cor `#cbd5e1`.
* **Negritos e Itálicos:** Tags `<strong>`/`<b>` e `<em>`/`<i>` são convertidas e tratadas para alternar a fonte ativa do PDFKit para `Helvetica-Bold` dinamicamente no fluxo do texto.
* **Listas:** Tags `<li>` são convertidas e renderizadas utilizando marcadores de círculos preenchidos (`•`).

### 4.4 Logs Estruturados e Tratamento de Exceções
A rota de exportação e a função geradora são totalmente protegidas contra falhas de execução:
* **Logs de Rastreamento (Logger):** Utiliza o `Logger('api/exportar')` para registrar cada etapa: início da requisição, carregamento do banco de dados em memória, inicialização do stream do PDFKit, progresso de renderização de títulos e proponentes da capa, e tamanho final em bytes do arquivo concluído.
* **Tratamento de Exceções:** Toda a compilação do arquivo é envelopada em blocos `try-catch` no nível da resposta HTTP e da `Promise` de geração. Se um erro ocorrer durante o parse de alguma seção ou tabela complexa, a API captura a exceção, registra o erro no `Logger` com a pilha de execução (stack trace) e retorna um status `500` com JSON explicativo, evitando travamentos no servidor de desenvolvimento Next.js.
