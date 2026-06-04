# TypeScript Clean Code - Complete Reference

> **📍 Localização:** `docs/07-skills/03-clean-code-skill.md`
> **📅 Última revisão:** 04/06/2026
> **📚 Índice geral:** [`docs/00-INDICE.md`](../00-INDICE.md)
> **📌 Origem:** Consolidado de [`.agent/skills/SKILL_clean_code.md`](../../.agent/skills/SKILL_clean_code.md)

## Descrição

Aplica todos os princípios de Clean Code de Robert C. Martin, Capítulo 17, adaptado para TypeScript. Use ao escrever, corrigir, editar, revisar ou refatorar qualquer código TypeScript.

---

## Comments (C1-C5)

- **C1:** Sem metadata em comentários (use Git)
- **C2:** Delete comentários obsoletos imediatamente
- **C3:** Sem comentários redundantes
- **C4:** Escreva comentários bem se necessário
- **C5:** Nunca commitar código comentado

## Environment (E1-E2)

- **E1:** Um comando para build (`npm run build`)
- **E2:** Um comando para testar (`npm test`)

## Functions (F1-F4)

- **F1:** Máximo 3 argumentos (use parameter objects/interfaces)
- **F2:** Sem argumentos de saída (use return values)
- **F3:** Sem flag arguments (split functions)
- **F4:** Delete funções mortas

## General (G1-G36)

### Princípios Básicos
- **G1:** Uma linguagem por arquivo
- **G2:** Implemente o comportamento esperado
- **G3:** Trate condições de contorno
- **G4:** Não sobrescreva seguranças
- **G5:** DRY - sem duplicação
- **G6:** Níveis de abstração consistentes
- **G7:** Classes base não conhecem filhos
- **G8:** Minimize interface pública
- **G9:** Delete código morto
- **G10:** Variáveis próximas ao uso
- **G11:** Seja consistente
- **G12:** Remova desordem
- **G13:** Sem acoplamento artificial

### Estrutura e Organização
- **G14-G20:** Organização de funções, classes, módulos
- **G21-G25:** Separação de concerns, encapsulamento

### Princípios SOLID
- **G26-G30:** Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion

### Nomes e Comunicação
- **G31-G36:** Nomes descritivos, comunicação clara

## Nomes (N1-N8)

- **N1:** Escolha nomes descritivos
- **N2:** Escolha nomes no nível correto de abstração
- **N3:** Use nomes técnicos quando aplicável
- **N4:** Use nomes de domínio do problema
- **N5:** Use nomes de domínio da solução
- **N6:** Nomes de classes devem ser substantivos
- **N7:** Nomes de métodos devem ser verbos
- **N8:** Não use trocadilhos

## Testes (T1-T7)

- **T1:** Testes insuficientes são melhor que nenhum teste
- **T2:** Use cobertura de ferramentas
- **T3:** Não pule testes triviais
- **T4:** Um assert por teste
- **T5:** Um conceito por teste
- **T6:** FIRST (Fast, Independent, Repeatable, Self-validating, Timely)
- **T7:** Princípio deBoundary Testing (Fuzz, Boundary, Inverse)

## Aplicação no Capta+

Este skill é usado extensivamente no Capta+:

- ✅ Repositórios (Repository Pattern - G7, G8)
- ✅ Services (Single Responsibility - G26)
- ✅ Tipos TypeScript (N1, N7)
- ✅ Tratamento de erros (G3, G4)
- ✅ Validação Zod (T1-T7)
- ✅ Estrutura de pastas (G14-G20)

**Exemplo concreto:**

```typescript
// ❌ RUIM (viola F1, F3, G12)
async function buscarEditais(
  status: string | undefined,
  orgao: string | undefined,
  dataInicio: string | undefined,
  dataFim: string | undefined,
  incluirFechados: boolean,
  debug: boolean
): Promise<Edital[]> {
  // 50 linhas
}

// ✅ BOM (segue F1, F3, G26)
interface FiltrosEditais {
  status?: string;
  orgao?: string;
  dataInicio?: string;
  dataFim?: string;
}

async function buscarEditais(filtros: FiltrosEditais): Promise<Edital[]> {
  // Implementação clara
}

async function buscarEditaisComDebug(filtros: FiltrosEditais, debug: boolean): Promise<Edital[]> {
  // Função separada para debug (F3)
}
```

---

## 📚 Documentação Relacionada

- **Frontend Design Skill:** [`01-frontend-skill.md`](01-frontend-skill.md)
- **Programação Skill:** [`02-programacao-skill.md`](02-programacao-skill.md)
- **Diretrizes de Codificação:** [`../02-arquitetura/02-mapa-projeto.md`](../02-arquitetura/02-mapa-projeto.md) (seção 16)
- **Estrutura do codebase:** [`../02-arquitetura/03-estrutura-codebase.md`](../02-arquitetura/03-estrutura-codebase.md)
