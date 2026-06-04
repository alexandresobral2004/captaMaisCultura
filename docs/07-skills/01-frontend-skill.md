# Frontend Design Skill

> **📍 Localização:** `docs/07-skills/01-frontend-skill.md`
> **📅 Última revisão:** 04/06/2026
> **📚 Índice geral:** [`docs/00-INDICE.md`](../00-INDICE.md)
> **📌 Origem:** Consolidado de [`.agent/skills/frontendSkill.md`](../../.agent/skills/frontendSkill.md)

## Descrição

Skill para criação de interfaces frontend distintas e prontas para produção, com alta qualidade de design. Use esta skill quando o usuário pedir para construir componentes web, páginas, dashboards, aplicações React, layouts HTML/CSS, ou ao estilizar qualquer UI web.

## Design Thinking

Antes de codificar, entenda o contexto e comprometa-se com uma direção estética BOLD:

- **Purpose**: Qual problema esta interface resolve? Quem usa?
- **Tone**: Escolha um extremo: minimalismo brutal, caos maximalista, retro-futurista, orgânico/natural, luxo/refinado, brinquedo/brincalhão, editorial/revista, brutalista, art déco, suave/pastel, industrial/utilitário, etc.
- **Constraints**: Requisitos técnicos (framework, performance, acessibilidade).
- **Differentiation**: O que torna INESQUECÍVEL? Qual é a única coisa que alguém vai lembrar?

**CRÍTICO**: Escolha uma direção conceitual clara e execute com precisão. Maximalismo ousado e minimalismo refinado funcionam - a chave é intencionalidade, não intensidade.

## Diretrizes de Estética Frontend

Foque em:

- **Tipografia**: Escolha fontes bonitas, únicas e interessantes. Evite fontes genéricas como Arial e Inter; opte por escolhas distintas que elevam a estética. Fontes inesperadas e com caráter.
- **Cor & Tema**: Comprometa-se com uma estética coesa. Use variáveis CSS para consistência. Cores dominantes com acentos afiados superam paletas tímidas e distribuídas uniformemente.
- **Movimento**: Use animações para efeitos e micro-interações. Priorize soluções CSS-only para HTML. Use Motion library para React quando disponível. Foque em momentos de alto impacto.
- **Composição Espacial**: Layouts inesperados. Assimetria. Sobreposição. Fluxo diagonal. Grid quebrado. Espaço negativo generoso OU densidade controlada.
- **Backgrounds & Detalhes Visuais**: Crie atmosfera e profundidade ao invés de cores sólidas. Adicione efeitos contextuais e texturas.

**IMPORTANTE**: Combine a complexidade da implementação com a visão estética. Designs maximalistas precisam de código elaborado com animações extensivas. Designs minimalistas precisam de restrição, precisão e atenção cuidadosa ao espaçamento.

## Princípios de Implementação

Ao implementar designs, mantenha estes princípios:

1. **Coesão**: Todos os elementos devem trabalhar juntos harmonicamente
2. **Intencionalidade**: Cada escolha de design deve ter um propósito
3. **Acessibilidade**: Não sacrifique usabilidade por estética
4. **Performance**: Animações devem ser performáticas
5. **Responsividade**: Design deve funcionar em diferentes telas

## Aplicação no Capta+

No contexto do **CaptaMais**, esta skill é aplicada para:

- ✅ Componentes de UI únicos (cards de editais, modais de revisão)
- ✅ Dashboard com métricas visuais
- ✅ Páginas de listagem com filtros
- ✅ Sistema de notificações com animações sutis
- ✅ Tema claro/escuro com transições suaves

**Restrição específica do projeto:** Evitar TailwindCSS, usar classes utilitárias nativas do `globals.css`. Preservar padrões estéticos (cantos arredondados, sombras suaves, micro-interações via CSS).

---

## 📚 Documentação Relacionada

- **Programação Skill:** [`02-programacao-skill.md`](02-programacao-skill.md)
- **Clean Code Skill:** [`03-clean-code-skill.md`](03-clean-code-skill.md)
- **Design System:** [`../02-arquitetura/02-mapa-projeto.md`](../02-arquitetura/02-mapa-projeto.md) (seção 11)
- **Componentes UI:** [`../02-arquitetura/02-mapa-projeto.md`](../02-arquitetura/02-mapa-projeto.md) (seção 12)
