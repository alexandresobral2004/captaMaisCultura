# Planejamento: Ícones com Cores Vibrantes

## 1. Análise da Situação Atual

O projeto atualmente utiliza **Lucide React** com ícones em tons neutros (cinza/cinza escuro). O objetivo é destacar menus e botões com cores mais vibrantes para melhorar a experiência visual e navegação.

## 2. Bibliotecas de Ícones Recomendadas

### 2.1 Opção Principal: Phosphor Icons (Duotone/Fill)

**Vantagens:**
- Variantes `duotone` e `fill` com cores mais vibrantes
- Excelente integração com React/Next.js
- +7.000 ícones disponíveis
- Suporte a pesos: thin, light, **regular**, **bold**, fill, duotone
- TypeScript completo

**Instalação:**
```bash
npm install @phosphor-icons/react
```

**Uso com cores vibrantes:**
```tsx
import { House, FlaskConical, FileText, CheckCircle } from '@phosphor-icons/react';

// Ícone fill com cor vibrante
<House weight="fill" color="#10B981" size={24} />

// Ícone duotone com cor primária
<FlaskConical weight="duotone" color="#8B5CF6" size={24} />

// Ícone regular com cor de destaque
<FileText weight="regular" color="#F59E0B" size={24} />
```

### 2.2 Alternativa: Tabler Icons

**Vantagens:**
- Estilo consistente com stroke de 2px
- +4.000 ícones
- Cores vibrantes por padrão
- Similar ao Lucide mas com personalidade própria

**Instalação:**
```bash
npm install @tabler/icons-react
```

### 2.3 Opção Híbrida: Lucide com Cores Customizadas

Manter Lucide (já em uso) e aplicar cores vibrantes via CSS/classe:

```tsx
import { Home, FlaskConical, FileText, Settings } from 'lucide-react';

// Aplicar cores vibrantes via className ou inline style
<Home className="text-emerald-500" size={24} />
<FlaskConical className="text-violet-500" size={24} />
```

## 3. Paleta de Cores Vibrantes Recomendada

### Cores por Seção do Menu

| Seção | Cor Primária | Cor Secundária | Hex |
|-------|--------------|----------------|-----|
| **Início/Dashboard** | Emerald | Verde vibrante | `#10B981` |
| **Editais** | Amber | Âmbar | `#F59E0B` |
| **Projetos Culturais** | Sky | Azul céu | `#0EA5E9` |
| **Análise Científica** | Violet | Roxo | `#8B5CF6` |
| **Configurações** | Slate | Cinza azulado | `#64748B` |

### Cores para Estados de Botões

| Estado | Cor | Hex |
|--------|-----|-----|
| Default | Emerald 500 | `#10B981` |
| Hover | Emerald 600 | `#059669` |
| Active | Emerald 700 | `#047857` |
| Disabled | Slate 400 | `#94A3B8` |
| Error | Rose 500 | `#F43F5E` |
| Warning | Amber 500 | `#F59E0B` |
| Success | Emerald 500 | `#10B981` |

## 4. Implementação Proposta

### 4.1 Fase 1: Instalação e Configuração

```bash
npm install @phosphor-icons/react
```

### 4.2 Fase 2: Criar Componente IconWrapper

```tsx
// components/ui/icon-wrapper.tsx
import { IconProps } from '@phosphor-icons/react';

interface VibrantIconProps extends IconProps {
  variant?: 'default' | 'fill' | 'duotone';
  colorScheme?: 'emerald' | 'amber' | 'sky' | 'violet' | 'slate' | 'rose';
}

const colorMap = {
  emerald: '#10B981',
  amber: '#F59E0B',
  sky: '#0EA5E9',
  violet: '#8B5CF6',
  slate: '#64748B',
  rose: '#F43F5E',
};

export function VibrantIcon({ 
  colorScheme = 'emerald', 
  color,
  ...props 
}: VibrantIconProps) {
  const finalColor = color || colorMap[colorScheme];
  return <Icon weight="duotone" color={finalColor} {...props} />;
}
```

### 4.3 Fase 3: Atualizar Sidebar

```tsx
// Exemplo em components/layout/sidebar.tsx
import { House, FlaskConical, FileText, CheckCircle, Settings } from '@phosphor-icons/react';

const menuItems = [
  { 
    href: "/dashboard", 
    label: "Início", 
    icon: House, 
    iconProps: { colorScheme: 'emerald' }
  },
  { 
    href: "/editais", 
    label: "Meus Editais", 
    icon: FileText, 
    iconProps: { colorScheme: 'amber' }
  },
  {
    href: "/analise-cientifica",
    label: "Análise Científica",
    icon: FlaskConical,
    iconProps: { colorScheme: 'violet' }
  },
];
```

### 4.4 Fase 4: Atualizar Botões

```tsx
// Exemplo de botão com cor vibrante
<Button className="bg-emerald-500 hover:bg-emerald-600 text-white">
  <CheckCircle weight="fill" className="mr-2" />
  Confirmar
</Button>
```

## 5. Comparativo de Bibliotecas

| Biblioteca | Ícones | Cores Vibrantes | Tamanho Bundle | TypeScript |
|------------|--------|-----------------|----------------|------------|
| Phosphor Icons | ~7.000 | ✅ Duotone/Fill | ~200KB | ✅ Completo |
| Tabler Icons | ~4.000 | ✅ Nativo | ~150KB | ✅ Completo |
| Lucide (atual) | ~1.500 | ⚠️ Via CSS | ~90KB | ✅ Completo |
| Heroicons | ~600 | ⚠️ Via CSS | ~80KB | ✅ Completo |

## 6. Recomendação Final

**Recomendação:** Usar **Phosphor Icons** como biblioteca principal com variante `duotone` para ícones do menu, mantendo **Lucide** para ícones menores (badges, status, ações).

**Motivos:**
1. Variantes `duotone` oferecem cores vibrantes nativas sem CSS adicional
2. +7.000 ícones cobre todos os casos de uso
3. Integração TypeScript completa
4. Bundle size aceitável (~200KB vs ~90KB do Lucide)

## 7. Próximos Passos

1. [ ] Instalar `@phosphor-icons/react`
2. [ ] Criar componente `VibrantIcon` wrapper
3. [ ] Mapear cores por seção do menu
4. [ ] Atualizar sidebar com novos ícones
5. [ ] Atualizar botões principais com cores vibrantes
6. [ ] Testar contraste e acessibilidade
7. [ ] Documentar padrão no codebase
