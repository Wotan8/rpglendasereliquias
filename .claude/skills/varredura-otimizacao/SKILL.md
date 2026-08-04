---
name: varredura-otimizacao
description: Varredura de otimização e simplificação sobre código que já funciona, sem mudar comportamento. Use quando o usuário pedir análise de otimização, limpeza de complexidade desnecessária, "deixar mais liso/fluido", caça a código morto ou revisão de desempenho de uma frente inteira do projeto.
---

# Varredura de otimização — sem quebrar nada

Uma regra domina todas: **comportamento observável não muda**. Mesmas saídas,
mesmos efeitos colaterais na mesma ordem, mesmos contratos. Se uma melhoria
exigir mudança de comportamento, ela não entra na varredura — vira proposta
separada para o usuário aprovar.

## O que conta como observável aqui

Além do óbvio (saídas, ordem dos efeitos, API pública, mensagens de erro), este
projeto tem quatro contratos que vivem fora do código:

1. **Nomes de campo do Firestore** — documentos já gravados são o contrato.
   Renomear campo "interno" quebra ficha salva de jogador. Sem migração escrita,
   sem renomeação. Casos sensíveis conhecidos: `valoresDer`, `vinculos`/`mesaId`,
   `statusVitaisVinculados`, o prefixo `Perícia:` em referências.
2. **Globais `window.*` chamados por `onclick=` no HTML** — 95 em
   `painel-mestre.html`, 41 em `ficha.html`. Função sem nenhum chamador no JS
   pode estar viva por string no HTML. É o campo minado do "código morto".
3. **`sw.js`** — arquivo movido ou renomeado exige atualizar `PRECACHE_URLS`;
   qualquer arquivo precacheado alterado exige subir a `VERSION`. Sem isso o
   usuário fica no código velho, ou pior, mistura velho com novo.
4. **`firestore.rules`** — as permissões olham campos específicos; mudar o shape
   de um documento pode esbarrar nelas.

## Escopo: uma frente por vez

Frentes: `ficha-v1.7_1/` · `criar-personagem/` · `tabuleiro/` · `painel-mestre/` ·
`painel-criador/` · `worldbuilding/` · `laboratorium-runarum/` · `menu/` ·
`shared/` · `js/` (raiz) · `functions/`.

São ~73k linhas de JS no total — varredura global não cabe numa passada útil.
Fase 1 pode ser panorâmica; **Fase 2 é sempre dentro de UMA frente**, com
aprovação por frente.

## Fase 1 — somente leitura, não pule

Mapeie antes de tocar em qualquer arquivo: pontos de entrada, fluxo de dados,
quem chama o quê, o que é compartilhado (`shared/` é usado pelos três
inventários — ficha, aliados e NPCs; regressão ali pega os três de uma vez) e
qual portão de verificação existe em cada área.

**Meça antes de propor** — "mais liso" sem número é opinião:
- tabuleiro → abra com `?perf=1` no celular e leia os ms por etapa;
- demais páginas → tempo até a tela útil e nº de reads do Firestore no boot.

Apresente em tabela e **espere aprovação antes da Fase 2**:

| Local | Problema | Técnica | Ganho percebido | Ganho de leitura | Risco | Portão |
|---|---|---|---|---|---|---|

Ganho percebido = o que o jogador sente na mesa (fluidez, boot, travada no
celular). Ganho de leitura = manutenção. São colunas separadas de propósito:
ordene por **ganho percebido ÷ risco** e liste os de pura legibilidade depois —
senão a varredura entrega 30 refactors cosméticos e zero fluidez.

## Onde procurar, em ordem de valor

Complexidade algorítmica errada (laço aninhado que poderia ser hash, ordenação
repetida, N+1 de leitura no Firestore) · trabalho repetido que daria para
calcular uma vez · abstração de uso único que só adiciona salto de leitura ·
condicional aninhada profunda que vira early return ou tabela de despacho ·
estado mutável compartilhado sem necessidade · tratamento de erro duplicado ·
código que reimplementa à mão o que a plataforma já faz.

Duas ressalvas:

- **Reuse antes de inventar.** O projeto já tem primitivas prontas (`shared/*`,
  `tabuleiro/js/tab-perf.js`, `tabuleiro/js/tab-write-queue.js`). Técnica nova só
  depois de confirmar que nenhuma delas serve.
- Se a técnica "avançada" deixa o código mais difícil de entender sem ganho
  mensurável, ela está errada. Prefira sempre a solução mais simples que funciona.

## Portões de verificação

| Natureza do código | Portão obrigatório |
|---|---|
| lógica pura (ou extraível para pura) | `.test.mjs` ao lado, no padrão da casa: `assert` + `node arquivo.test.mjs`, sem framework |
| render / DOM / interação | harness `__check-*.html` — 15 já existem, copie o mais próximo |
| Firebase ao vivo ou multiplayer | QA manual com duas abas: modo secreto (mestre) + público (jogador) |
| nada disso cobre | **não mexe** — registra na tabela como "sem portão" |

Não existe `npm test` neste projeto. A suíte inteira roda assim:

```bash
for f in $(find . -name "*.test.mjs" -not -path "./.claude/*" -not -path "*/node_modules/*"); do node "$f" || echo "FALHOU: $f"; done
```

## Segurança da mudança

- **Nunca remova código por parecer morto.** Prove: grep no JS, nos `.html`
  (`onclick=` e template strings que montam HTML), nas atribuições `window.*`,
  nos nomes de campo do Firestore, em `sw.js`, nas rules e nos scripts de
  `functions/`.
- Complexidade estranha sem razão aparente: assuma que existe uma razão que você
  não está vendo e **pergunte antes de simplificar**.
- Uma mudança por vez, rodando o portão entre elas, **um commit por item** para
  reverter sair barato.
- Portão quebrou: pare, reverta e conte. **Nunca ajuste o teste** para acomodar
  a mudança.
- Fechou a frente: mexeu em arquivo precacheado? Suba a `VERSION` do `sw.js`.
