# Task — Redutor como campo de equação no módulo de classe

> Objetivo, nas suas palavras: **toda skill que tem redutor deve poder defini-lo
> no próprio módulo de classe, junto da seleção do VD — subtraindo do valor do VD
> escolhido, exibindo a fórmula na ficha e o resultado já calculado.** O campo
> aceita equação, para o jogador enxergar o Alvo do teste sem fazer conta na mão.
> O Tabuleiro tem que interpretar isso igual.

## O que já existe (feito em 01/09/2026)

Não comece do zero. O redutor do **Domínio** já roda:

- `shared/dominio-redutor.js` — módulo puro com `redutorDoDominio`, `redutorTotal`,
  `nivelDoDominio`, `podeUsar`, `alvoComRedutor`. Tem auto-teste: `node shared/dominio-redutor.js`.
- `classModules.dominioId` — 20 módulos de arte ligados ao seu Domínio.
- `equipment.dominioId` / `items.dominioId` — 114 peças com a família restaurada.
- Ficha: `_cmRedutorDoDominio()` e `_cmAplicarRedutorNoChip()` em
  `class-modules-renderer.js` já subtraem no chip do VD e mostram `7 − 4`.
- Tabuleiro: `linhasDeAtaque()` já subtrai o redutor do `l.acerto` das armas.

**O que falta é generalizar.** Hoje o redutor da magia é lido de um campo de texto
cujo rótulo casa `/^redutor/i` — chave `3` na Hemomancia, `4` na Abismancia,
inexistente na Totemancia (cap. 13 §13.1). É frágil e não aceita equação.

---

## A ordem que eu recomendo

### 1. Tipo de campo `redutor` no editor de módulo

Um tipo novo no schema, irmão do `select_vd`, com:

| propriedade | o que é |
|---|---|
| `vinculadoA` | a chave do campo `select_vd` de onde ele subtrai |
| `equacao` | os termos, no mesmo formato de `valoresDerivadosVinculados` |
| `somaDominio` | booleano — se o redutor de Domínio entra na conta (padrão: sim) |

Reaproveite o editor de equação que os itens já usam (`shared/equip-campos.js`,
termos `{tipo:'ficha', ref:'…'}`). **Não escreva um segundo editor de fórmula.**

**Por que este passo é o primeiro:** os quatro seguintes leem esse campo. Fazer a
ficha antes do cadastro obriga a inventar um formato provisório e migrar duas vezes.

### 2. Migrar os campos de texto existentes

67 magias têm `Redutor` como texto (`"-3"`, `"0"`, `""`). Vire equação de um termo
fixo. Script com dry-run, `--apply` e âncora, como o resto de `functions/`.

Duas armadilhas:
- **A chave varia por escola.** Case pelo rótulo, não pela chave, e registre o mapa.
- **O sinal é inconsistente** — há `"-3"` e há `3`. `redutorTotal()` já usa `Math.abs`;
  a migração deve normalizar para um só na gravação.

Vale migrar junto o **Redutor do Véu** (`shared/incorporacao.js`), hoje um caso
especial em código que faz exatamente o que este campo passa a fazer. Se couber,
o arquivo some.

### 3. Ficha: fórmula e resultado

Estenda `_cmAplicarRedutorNoChip()`, que já mostra `7 − 4` e põe o Alvo reduzido.
Falta: montar a fórmula a partir da equação (não do número pronto) e mostrar de
onde cada parcela veio.

Alvo de exibição:

```
🎯 Alvo de Transcendência   7 − 2 (Véu Etérico) − 1 (Domínio 1 < Q2) = 4
```

Regras da casa: em tela pequena tudo encolhe junto (responsivo é requisito, não
ajuste depois), e o chip já tem `.cm-dv-formula` e `.cm-dv-reduzido` no CSS.

### 4. Tabuleiro: mesma conta, mesma fonte

O Tabuleiro monta o Alvo em `tab-turno.js` e `tab-ficha-win.js`. **Não reimplemente
a conta** — a régua tem que morar em um módulo puro compartilhado, como
`dominio-redutor.js`, e os dois lados chamarem o mesmo.

Já há precedente do que dá errado: o Redutor do Véu foi implementado no Tabuleiro
(`tab-dadiva-sorteio.js`, `tab-turno.js`) e não existe na ficha. A conta em dois
lugares diverge; a de um lugar só, não.

Desempenho: `linhasDeAtaque` roda por token; a conta é aritmética pura e barata,
mas não vá buscar `dots` do Firestore dentro do laço.

### 5. Auditoria e livro

- Estender `functions/__audit-redutor-dominio.mjs` para ler o campo novo em vez de
  varrer rótulo por escola.
- Atualizar o cap. 13 §13.3: `redutor` deixa de ser `number ≤ 0` e vira equação.

---

## O que NÃO fazer

**Não** aplique o redutor no dado. Ele entra no **Alvo**, sempre — arma mal
empunhada faz errar, não bater fraco (cap. 12 §12.3).

**Não** faça o redutor de Domínio "valer o maior" com o próprio. A decisão de
31/08 é que os dois **somam**, e cinco magias já foram rebalanceadas em cima disso
(cap. 12 §12.3b). Mudar isso agora desfaz o rebalanceamento.

**Não** hardcodeie régua. Se falta campo, cria o campo e migra o dado.

## Casos para validar

| caso | esperado |
|---|---|
| Transcendência — Projetor (Q1), Domínio 1 | redutor 0 — a classe joga no dia 1 |
| Transcendência — Projetor no Véu Astral | redutor 4, só do Véu |
| Armadura Sanguínea (Q3, Rp −2), Domínio 1 | redutor 4 · Alvo 7 → 3 |
| A SINFONIA (Q5, Rp 0), Domínio 1 | redutor 4 · Alvo 7 → 3 |
| A SINFONIA, Domínio 5 | redutor 0 |
| Espada Longa Q0 sem Domínio de Braço | não gera linha de ataque |
| armadura, mochila, ingrediente | sem `dominioId` — passa, nunca é barrado |
