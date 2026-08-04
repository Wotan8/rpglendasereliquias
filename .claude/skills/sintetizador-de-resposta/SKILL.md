---
name: sintetizador-de-resposta
description: Adiciona um bloco de síntese no final de cada resposta, cobrindo TODOS os pontos abordados de forma limpa e direta, para leitura rápida. Use quando o usuário chamar /sintetizador-de-resposta, pedir "sintetiza a resposta", "resume no final", "modo síntese" ou reclamar que a resposta ficou longa demais para ler.
---

Modo síntese ativo. Vale para **esta resposta e todas as seguintes**, até o usuário dizer "desliga a síntese" / "modo normal".

Escreva a resposta normal, completa, como faria sem a skill. Só então, como última coisa antes de encerrar, adicione:

```
---
## Síntese

- **<Ponto>** — <o que é, em uma linha>
- ...
```

Regras da síntese:

- **Cobertura total.** Todo ponto abordado na resposta vira um item. Decisão tomada, arquivo mexido, número, alternativa descartada, ressalva, pergunta em aberto, próximo passo — nada some. Se a resposta tem 12 pontos, a síntese tem 12 itens. A síntese é o índice da resposta, não um resumo executivo dela.
- **Uma linha por item.** Substantivo em negrito + o essencial. Sem parágrafo, sem justificar de novo o que já foi justificado acima.
- **Mesma ordem da resposta.** O usuário lê a síntese, acha o ponto que quer e sobe até ele. A ordem é o mapa; não reorganize por importância.
- **Sem informação nova.** Nada aparece na síntese que não esteja na resposta acima. Se for importante, escreva no corpo primeiro.
- **Marque o que exige ação.** Item que depende do usuário (decisão, resposta, arquivo a revisar) começa com `⚠`.
- **Agrupe se passar de ~12 itens.** Subtítulos `### <Tema>` com os itens embaixo, mantendo a ordem.

Não sintetize quando a resposta inteira já for curta (até ~5 linhas) — repetir dois itens de uma resposta de três linhas é ruído.
