# 🧪 Instruções de Teste - Sistema de Busca TI

## ✅ Pré-requisitos

### 1. Verificar Variáveis de Ambiente
```bash
# Verificar se as variáveis estão em .env.local
cat /Users/alexandrerocha/captaMais/.env.local | grep -E "OPENAI|PROSAS"

# Esperado:
# PROSAS_EMAIL=seu_email@example.com
# PROSAS_PASSWORD=sua_senha
# OPENAI_API_KEY=sk-proj-xxxxx
```

### 2. Verificar Portais Configurados
```bash
# Ver portais em data/portais-config.json
cat /Users/alexandrerocha/captaMais/data/portais-config.json | jq '.[] | {id, nome}'

# Deve conter:
# - prosas
# - finep
# - cnpq
# - capes
```

---

## 🚀 TESTE 1: Build da Aplicação

```bash
cd /Users/alexandrerocha/captaMais
npm run build
```

**Resultado esperado**:
```
✓ Compiled successfully
Linting and checking validity of types ...
...
○ (Static)   prerendered as static content
ƒ (Dynamic)  server-rendered on demand
```

---

## 🚀 TESTE 2: Iniciar Servidor

```bash
cd /Users/alexandrerocha/captaMais
npm run dev
```

**Resultado esperado**:
```
▲ Next.js 14.2.35
- ready started server on 0.0.0.0:3000, url: http://localhost:3000
```

Deixar o terminal aberto durante os testes.

---

## 🚀 TESTE 3: Chamar API de Busca Consolidada

Em outro terminal:

```bash
curl -X POST http://localhost:3000/api/editais/busca \
  -H "Content-Type: application/json" \
  -w "\n\nStatus: %{http_code}\n"
```

**Duração esperada**: 2-3 minutos

**Resultado esperado**:
```json
{
  "success": true,
  "mensagem": "✅ Busca consolidada concluída: 300 editais analisados em 2.5 minutos",
  "estatisticas": {
    "totalEditaisValidos": 330,
    "processados": 300,
    "comErro": 30,
    "tempoMinutos": 2.5,
    "porTecnologia": {
      "IA & Machine Learning": 85,
      "Big Data & Analytics": 60,
      "Cloud Computing": 45,
      ...
    }
  },
  "quantidade": 300,
  "editais": [...]
}

Status: 200
```

### O que está acontecendo:
1. **Prosas** busca 404 editais → valida com OpenAI → retorna ~220 TI
2. **FINEP** busca ~50 editais → valida com OpenAI → retorna ~25 TI
3. **CNPq** busca ~75 editais → valida com OpenAI → retorna ~40 TI
4. **CAPES** busca ~30 editais → valida com OpenAI → retorna ~15 TI
5. **Consolidação**: ~330 editais válidos em TI no total

---

## 🔍 TESTE 4: Verificar Dados Salvos

### 4.1 Contar total de editais
```bash
cat /Users/alexandrerocha/captaMais/data/editais.json | jq 'length'

# Esperado: ~330
```

### 4.2 Ver distribuição por tecnologia
```bash
cat /Users/alexandrerocha/captaMais/data/editais.json | \
  jq '[.[] | .tecnologiaFoco] | group_by(.) | map({tecnologia: .[0], quantidade: length}) | sort_by(.quantidade) | reverse'

# Esperado:
# [
#   { "tecnologia": "IA & Machine Learning", "quantidade": 85 },
#   { "tecnologia": "Big Data & Analytics", "quantidade": 60 },
#   { "tecnologia": "Cloud Computing", "quantidade": 45 },
#   ...
# ]
```

### 4.3 Ver detalhes de um edital TI
```bash
cat /Users/alexandrerocha/captaMais/data/editais.json | \
  jq '.[0] | {id, titulo, orgao, tecnologiaFoco, tipoFerramenta, scoreRelevancia, scoreConfiancaIA, palavrasChaveEncontradas}'

# Esperado:
# {
#   "id": "prosas-123456",
#   "titulo": "Desenvolvimentos de Aplicações com IA",
#   "orgao": "FINEP",
#   "tecnologiaFoco": "IA & Machine Learning",
#   "tipoFerramenta": "Framework",
#   "scoreRelevancia": 85,
#   "scoreConfiancaIA": 92,
#   "palavrasChaveEncontradas": ["software", "inteligência artificial", "machine learning"]
# }
```

### 4.4 Ver quantos editais têm cada tecnologia
```bash
cat /Users/alexandrerocha/captaMais/data/editais.json | \
  jq '.[] | .tecnologiaFoco' | sort | uniq -c | sort -rn

# Esperado:
#      85 "IA & Machine Learning"
#      60 "Big Data & Analytics"
#      45 "Cloud Computing"
#      40 "Data Science"
#      30 "Segurança & Criptografia"
#      ...
```

### 4.5 Filtrar apenas editais de IA
```bash
cat /Users/alexandrerocha/captaMais/data/editais.json | \
  jq '.[] | select(.tecnologiaFoco == "IA & Machine Learning") | {titulo, scoreRelevancia}' | head -20

# Ver primeiros 20 editais de IA
```

---

## 📊 TESTE 5: Validações de Qualidade

### 5.1 Verificar se nenhum edital tem `foraDoEscopo === true`
```bash
cat /Users/alexandrerocha/captaMais/data/editais.json | \
  jq '[.[] | select(.foraDoEscopo == true)] | length'

# Esperado: 0 (zero)
# (Porque editais rejeitados são deletados, não marcados como fora do escopo)
```

### 5.2 Verificar score de relevância (deve ser >50)
```bash
cat /Users/alexandrerocha/captaMais/data/editais.json | \
  jq '[.[] | .scoreRelevancia] | {media: (add / length), minimo: min, maximo: max}'

# Esperado:
# {
#   "media": 75,
#   "minimo": 50,
#   "maximo": 100
# }
```

### 5.3 Verificar confiança IA (deve ser >70%)
```bash
cat /Users/alexandrerocha/captaMais/data/editais.json | \
  jq '[.[] | .scoreConfiancaIA] | {media: (add / length | round), minimo: min, maximo: max}'

# Esperado:
# {
#   "media": 82,
#   "minimo": 30,  # (fallback baixo)
#   "maximo": 100
# }
```

### 5.4 Verificar se todos têm `validadoPorIA === true`
```bash
cat /Users/alexandrerocha/captaMais/data/editais.json | \
  jq '[.[] | select(.validadoPorIA != true)] | length'

# Esperado: 0 (zero)
```

### 5.5 Ver distribuição de palavras-chave
```bash
cat /Users/alexandrerocha/captaMais/data/editais.json | \
  jq '.[] | .palavrasChaveEncontradas[]' | sort | uniq -c | sort -rn | head -20

# Esperado:
# Termos TI mais frequentes:
#      250 "software"
#      180 "inteligência artificial"
#      150 "desenvolvimento"
#      120 "python"
#      ...
```

---

## 🎯 TESTE 6: Próxima Fase - Download de PDFs

**Após validar a busca e categorização**, os próximos passos são:

1. **Download de PDFs**:
   - O sistema já tem os editais categorizados
   - Precisa fazer POST novamente para ativar download
   - PDFs serão salvos em `data/downloads/`

2. **Análise com IA**:
   - Cada PDF será analisado com OpenAI
   - Extração de requisitos, elegibilidade, etc
   - Score de adequação por projeto

3. **Cadastro no Sistema**:
   - Todos os dados consolidados em `data/editais.json`
   - Interface web para visualização

---

## ⚠️ Troubleshooting

### Problema: "OPENAI_API_KEY not found"
```bash
# Solução: Adicionar em .env.local
echo "OPENAI_API_KEY=sk-proj-xxxxx" >> /Users/alexandrerocha/captaMais/.env.local
# Reiniciar servidor (npm run dev)
```

### Problema: Timeout na busca Prosas
```bash
# Normal: Prosas valida 404 editais com OpenAI (cada um leva 10-15s)
# Esperado: 3-4 minutos apenas para Prosas
# Se >5 minutos: verificar conexão internet ou limite OpenAI rate
```

### Problema: API retorna erro 500
```bash
# Verificar logs no terminal onde npm run dev está rodando
# Procurar por:
# - "Erro ao buscar detalhe"
# - "Falha OpenAI"
# - "Rate limit exceeded"
```

### Problema: Poucos editais TI encontrados (<100)
```bash
# Verificar:
1. Whitelist foi carregada corretamente?
2. OpenAI está respondendo?
3. Portais estão acessíveis?

# Debug:
cat /Users/alexandrerocha/captaMais/lib/scraper/filtros-ti.ts | \
  grep -A 5 "const WHITELIST_TI"
```

---

## 📈 Métricas de Sucesso - Checklist

- [ ] Build compila sem erros
- [ ] Servidor inicia em http://localhost:3000
- [ ] API `/api/editais/busca` retorna 200 OK
- [ ] Total de editais > 200
- [ ] Distribuição por tecnologia > 5 categorias com dados
- [ ] Score relevância média > 70
- [ ] Confiança IA média > 80%
- [ ] Nenhum edital com `foraDoEscopo = true`
- [ ] Todos os editais têm `validadoPorIA = true`
- [ ] Palavras-chave encontradas em todos os editais

---

## 📞 Suporte

Se encontrar problemas:

1. **Verificar logs**:
   ```bash
   # Terminal onde npm run dev está rodando
   # Procurar por mensagens de erro
   ```

2. **Verificar dados**:
   ```bash
   # Conferir estrutura de editais.json
   cat /Users/alexandrerocha/captaMais/data/editais.json | jq 'if length > 0 then .[0] | keys else "arquivo vazio" end'
   ```

3. **Reiniciar zero**:
   ```bash
   # Limpar dados
   rm /Users/alexandrerocha/captaMais/data/editais.json
   
   # Reiniciar servidor
   npm run dev
   
   # Fazer nova busca
   curl -X POST http://localhost:3000/api/editais/busca
   ```

---

**Data**: 29 de Maio de 2026  
**Sistema**: Pronto para Teste ✅

