# Triagem de editais (Jev como juiz principal)

Duas etapas. Cada uma termina em **aceitar**, **dúvida** (uma pessoa revisa, status `duvida`) ou **descartar**.

## 1. Pelo título (`lib/triagem/index.ts`)
1. Regras baratas: região por palavras, itens de menu (`tituloInstitucional`), notícia/resultado.
2. Jev (uma consulta, perguntas em paralelo): eixo, "é chamada?", relevância, restrição regional. As palavras da whitelist e os termos da blacklist de TI entram só como informação no estado enviado.
3. Cortes: confiança mínima 75 (`JEV_CONFIANCA_MINIMA`) para decidir; **descarte só com 90 ou mais** (`JEV_CONFIANCA_DESCARTE`). Entre os dois, vai para dúvida.
4. Reserva: a OpenAI (`openai-classifier.ts`) só roda quando o Jev está fora do ar ou abaixo da confiança mínima. Whitelist e blacklist não rejeitam sozinhas; a whitelist só rejeita quando nenhuma IA respondeu e não há termo algum.

## 2. Pelo documento baixado (`lib/scraper/validacao-documento.ts`)
1. Procura palavras de edital em 8 grupos (identificação, objeto, inscrição, prazo, elegibilidade, recursos, seleção, disposições finais).
2. Menos de 2 grupos: descartado sem consultar o Jev.
3. O Jev recebe título, palavras e trechos: 70% ou mais aceita, 25% ou menos descarta, entre os dois é dúvida. Sem Jev: 3 ou mais grupos aceita, 2 vai para dúvida.
4. Documento confirmado soma 30 pontos na nota (`calcularPontuacaoEdital`), no lugar da antiga consulta à OpenAI.
