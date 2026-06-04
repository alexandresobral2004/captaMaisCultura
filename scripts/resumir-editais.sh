#!/bin/bash

# Script para resumir editais usando o script TypeScript
# Uso: ./scripts/resumir-editais.sh

cd "$(dirname "$0")/.."

echo "🚀 Iniciando resumo de editais..."
echo ""

# Verifica se OpenAI API key está configurada
if [ -z "$OPENAI_API_KEY" ]; then
    echo "❌ Erro: OPENAI_API_KEY não está configurada"
    echo "   Configure com: export OPENAI_API_KEY=sk-xxx..."
    exit 1
fi

# Executa o script TypeScript compilado ou usando tsx
if command -v npx &> /dev/null; then
    echo "📦 Usando npx para executar o script..."
    npx ts-node scripts/resumir-editais.ts
else
    echo "❌ Erro: npx ou Node.js não encontrado"
    exit 1
fi

echo ""
echo "✅ Conclusão do processamento"
