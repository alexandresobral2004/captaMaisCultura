# Fluxo de Extração de PDF e Dados

## 📋 Resumo

O sistema agora segue um fluxo claro e bem documentado:

```
BAIXAR PDF → EXTRAIR TEXTO → ARMAZENAR → USAR PARA ANÁLISE
```

## 🔄 Fluxo Detalhado

### Etapa 1: Localizar e Baixar PDF

**Estratégia 1: PDF do S3 (Prioridade Máxima)**
- URL: Amazon S3 pré-assinada
- Tempo: Muito rápido
- Confiabilidade: ✅✅✅

**Estratégia 2a: Link Direto para PDF**
- URL: Arquivo .pdf direto no servidor
- Tempo: Rápido
- Confiabilidade: ✅✅

**Estratégia 2b: PDF dentro de Página Web**
1. Acessa a página web
2. Busca links de PDF na página
3. Download do PDF encontrado
- Tempo: Moderado
- Confiabilidade: ✅

**Estratégia 3: Fallback HTML**
- Se nenhum PDF funcionar, usa o HTML da página
- Extrai texto do HTML
- Tempo: Rápido
- Confiabilidade: ⚠️ (menos completo)

### Etapa 2: Extrair Texto do PDF

```javascript
// Fluxo de extração
1. Tentar pdfParse como função
2. Se falhar, tentar como class
3. Se tudo falhar, usar HTML fallback
```

**Resultado:**
- Texto em UTF-8 limpo
- Mínimo 100 caracteres para considerar sucesso
- Máximo 10.000 caracteres (limita para performance)

### Etapa 3: Armazenar PDF Original

```
data/downloads/edital-{id}.pdf
```

- ✅ PDF original completo (não modificado)
- ✅ Arquivo disponível para download
- ✅ Pode ser visualizado em qualquer leitor PDF

### Etapa 4: Usar Texto para Análise

O texto extraído é usado para:
1. **Análise com IA** (OpenAI)
   - Resumo do edital
   - Extração de requisitos
   - Extração de itens financiáveis
   - Score de compatibilidade

2. **Validação com Keywords** (opcional)
   - Conta palavras-chave relevantes
   - Calcula densidade
   - Score de relevância

## 📊 Exemplo Real

### Edital: "Edital RAÍZES"

```
🔽 ETAPA 1: Fazendo download...
   → Tentando S3: ✅ Sucesso!
   → PDF baixado: 1.2 MB

📄 ETAPA 2: Salvando PDF em data/downloads/edital-prosas-17723.pdf
   → ✅ PDF original armazenado

🔤 ETAPA 3: Extraindo texto do PDF...
   → Tentando pdfParse como função: ✅ Sucesso!
   → Texto extraído: 8.432 caracteres

✅ RESULTADO:
   - Arquivo: data/downloads/edital-prosas-17723.pdf (1.2 MB)
   - Texto: 8.432 caracteres prontos para análise
   - Fonte: pdf_s3
```

## 🎯 O que mudou

### Antes ❌
- Baixava PDF mas criava "fake PDFs" com apenas título
- Texto era apenas da descrição HTML
- PDF original não era preservado completamente

### Agora ✅
- PDF original é completamente preservado
- Texto é extraído do PDF real
- Se falhar, usa HTML como fallback
- Logs claros mostrando cada etapa

## 📝 Logs e Debugging

Ao processar um edital, você verá:

```
📥 [DOWNLOAD] Iniciando download do edital prosas-17723...
   - PDF S3: ✅
   - Link Externo: ✅
   - Descrição HTML: ✅
   📋 FLUXO: Baixar → Extrair Texto → Armazenar

   🔍 Estratégia 1: Baixando PDF do S3...
   🔽 ETAPA 1: Fazendo download...
   ✅ PDF baixado: 1248576 bytes

   📄 ETAPA 2: Salvando PDF em data/downloads/edital-prosas-17723.pdf
   ✅ PDF original armazenado

   🔤 ETAPA 3: Extraindo texto do PDF...
   ✅ Texto extraído: 8432 caracteres
```

## 🔗 Integração com Análise

Após extração bem-sucedida:

```typescript
{
  texto: "Conteúdo completo do PDF...",
  fonte: "pdf_s3",
  pdfUrlEncontrada: "https://...",
  caminhoArquivo: "data/downloads/edital-prosas-17723.pdf",
  tamanhoBytes: 1248576
}
```

Este objeto é passado para:
1. **PDF Downloader** → Salva arquivo
2. **IA Analyzer** → Análise com OpenAI
3. **Keyword Validator** → Validação (opcional)
4. **Database** → Armazenamento final

## 💡 Observações

1. **PDFs Originais São Preservados**
   - Nunca alteramos o arquivo original
   - Pode ser baixado e visualizado

2. **Extração de Texto**
   - Nem todos os PDFs extraem bem
   - Se falhar, usamos HTML como fallback
   - Sempre tenta múltiplas estratégias

3. **Performance**
   - S3: ~1-2 segundos
   - Links diretos: ~2-3 segundos
   - Páginas web: ~3-5 segundos
   - Extração de texto: ~100-500ms por PDF

4. **Armazenamento**
   - PDFs ficam em `data/downloads/`
   - Nomeados como `edital-{id}.pdf`
   - Tamanho típico: 0.5 - 5 MB

## 🚀 Próximos Passos

1. Baixar PDFs via "Disparar Busca"
2. PDFs originais são armazenados em `data/downloads/`
3. Texto é extraído e preparado
4. Clique "Analisar" para usar com IA
5. IA usa o texto extraído para gerar resumo

---

**Versão:** 2.9  
**Data:** 29 de Maio de 2026  
**Status:** ✅ Implementado com Logs Detalhados
