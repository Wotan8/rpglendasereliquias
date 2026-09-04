---
name: economia-de-exp-da-mesa
description: "Âncoras numéricas da economia de EXP (custo de atributo/perícia, EXP por sessão, orçamento de criação) usadas para precificar qualquer coisa que custe EXP"
metadata: 
  node_type: memory
  type: project
  originSessionId: ebc60805-71e3-4c2f-9276-ac72252ea9e0
  modified: 2026-08-02T12:02:21.849Z
---

Régua para precificar **qualquer** coisa que custe ou renda EXP em Lendas & Relíquias.
Levantada em 02/08/2026 ao rebalancear as Peculiaridades Avulsas.

**Custo de progressão** (`ficha-v1.7_1/js/exp-upgrade.js`, `getExpCost`):
- atributo → nível N = **5N** EXP (1→5 acumulado = 70)
- perícia → nível N = **4N** EXP, salvo `SKILL_COSTS` (0→5 acumulado = 60)
- ⇒ **âncora: +1 permanente numa perícia de meio de campanha ≈ 12 EXP** (degrau 2→3).
  Atributo é ~4× mais eficiente por EXP (pega várias perícias de uma vez).

**Teste** (Cap. 2 do [[livro-de-regras-do-jogador]]): Roll Under 1d10,
Alvo = Atributo + Perícia + Bônus − Redutor; 1 = crítico, 10 = falha crítica.
- **+1 no Alvo = +10 pontos percentuais**, com **teto duro no Alvo 9** — quem já
  soma 9 não recebe nada. É o breakpoint que mata os níveis 2-3 das peculiaridades
  situacionais: só o especialista compra, e é ele quem não recebe o bônus.
- **Vantagem/Desvantagem** (2d10, menor/maior) vale **1,6 a 2,5 pontos de Alvo**
  (máximo em Alvo 5: 50%→75%). Nunca tratar como se fosse ±1.

**EXP por sessão:** a rubrica do Mestre (`Prompt_Distribuicao_de_EXP.docx`, v3) manda
2–4 de base; a sessão 46, a única já rodada com ela, deu base 4/4/3/3/3 = **3,4** de
média (3,8 com o +1 de resumo). Sessões antigas, pré-rubrica, estavam infladas
(S26 e S27 = 6,0; S30 = 6,25) — não usar como referência. **Usar 3,5 EXP/sessão.**

**Orçamento de criação:** EXP Inicial = `mesa.expInicial + mesa.sessaoAtual`
(`criar-personagem/js/app.js`, regressão em `mesa-exp-inicial.test.mjs`). Com
expInicial 15 na sessão 47 → **62 EXP**, mais até 3 (NPCs) e 4 (memórias completas).
⇒ **1 EXP ≈ 0,29 sessão de jogo**; uma peculiaridade de 12 EXP custa 3,4 sessões.

Ver [[peculiaridades-avulsas-rebalanceadas]] para a aplicação dessa régua e
[[padrao-peculiaridades-avulsas]] para como as avulsas são cadastradas.
