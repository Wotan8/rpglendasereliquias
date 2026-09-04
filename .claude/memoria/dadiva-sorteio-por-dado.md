---
name: dadiva-sorteio-por-dado
description: "Dádivas: o hóspede entrega TODAS as nove, cada uma rola 1 dado com face de nenhum; Receptor paga pela entrega, Projetor pelo Poder+Véu."
metadata:
  type: project
---

Fechado em 25/08/2026, corrigindo um buraco que rodava em silêncio.

**A regra.** Quem incorpora recebe as **nove** Dádivas. Cada uma **sorteia UMA coisa**
dentro do grupo dela, e o dado tem **`n+1` saídas**: os n candidatos e o **NENHUM**.
Receber a Dádiva não é receber vantagem. O valor sorteado é SOMADO ao do personagem,
maior ou menor, até o teto (5 · Aura levanta · teto racial vence).

`dadoSugerido(n)` em `shared/dadiva.js`: menor dado padrão ≥ n+1, e o que passar de
n+1 **rerrola** — assim o nenhum vale sempre uma saída só, nunca 25% por acidente do
catálogo. 3 atributos → 1d4. 6 Sentidos → 1d8, 7 = nenhum, 8 rerrola.

**Os três furos que existiam** (não reintroduzir):
1. `dadivasDoHospede()` devolvia lista fixa de **sete** — Mente e Perícia nunca saíam.
   Agora devolve `Object.keys(DADIVAS)`.
2. Lia `hospede.ecoDadiva` / `.ecoEstado` **raso**; o Painel grava `eco.dadiva` /
   `eco.estado` **aninhado**. Nada do cadastro chegava, e por isso **o dobro do
   Ancestral nunca disparou**. `ehAncestral()` agora lê as duas formas.
3. O sorteio não tinha face de nenhum.

**A janela.** `tabuleiro/js/tab-dadiva-sorteio.js` — módulo só-DOM, aberto ANTES de
gastar ação/recurso (cancelar não custa nada). O Mestre digita o dado físico ou clica
🎲. Campo em branco é rolado ao aplicar, nunca vira nenhum em silêncio.
Arnês: `tabuleiro/__check-dadiva-sorteio.html` chama a função de verdade.

**Custo de Sanidade — duas contas diferentes, não misturar:**
- **Receptor** — `custoEscalonado(unidades)`: +1 Sanidade a cada 2 unidades acima de 2.
  Paga pelo que entrou nele. Custo declarado: `2 Energia` (a alternativa fixa
  `1 Energia + 2 Sanidade` saiu — era fixo por cima de variável).
- **Projetor** — `custoDaProjecao(hospede, veu)` = `1 + ⌊Poder ÷ 3⌋ + Véu(0/1/2)`.
  Não recebe Dádiva, então não abre a janela de sorteio, e sim a do Véu.
  ⚠️ **Nunca voltar a cobrar o Projetor por unidades de Dádiva**: aquela conta é
  cortada pelo teto de QUEM RECEBE, então media o espaço que sobrava na ficha do Xamã.
  Mesmo Eco, mesmo benefício, e o veterano no teto pagava ZERO.

Poder do hóspede = `eco.prs` (campo do Painel) ou, vazio, a `PRS` da ficha — o mesmo
número que o teste de Supressão usa como Redutor. Bicho cai na ficha, e o Druida paga.

**§9 da Régua reescrito em 25/08** (`DA76qGdp3QZp8VCCUQPF`, `functions/regua-cap9-reescreve.mjs`).
Achado que ficou registrado lá: a **escalonada não segura a faixa** — a razão vai de 0,67× a
3,18× conforme a entrega cresce, e segurar 1,70× a 12 unidades exigiria 14 de Sanidade em vez
de 5. Ela é **preço de risco**, não dispositivo de faixa; a Incorporação é medida por
**conformidade (§11)**, e o carimbo dela é `razao: null` de propósito.

**PRS = PODER, fonte única na ficha** (resolvido 25/08). A PRS vinha sendo pedida para ser
duas coisas com ordenações opostas: o §9.9 a usava como RESISTÊNCIA (Furioso 4, Corrompido 5,
Sereno 1) e as fichas como PODER (Servo 2, Mestre de Armas 8) — e o Projetor, que precifica
pela ficha, cobrava menos por um Ancestral que por um Furioso.
Ficou **Poder**; a resistência continua entrando pelo termo `(5 − Disposição)` do redutor da
Supressão, que a tabela de Estado alimenta. **Estado e Poder são ortogonais** — um Sereno pode
ser poderoso. A coluna PRS saiu da tabela do §9.9 e o campo duplicado `eco.prs` saiu do Painel;
`poderDoHospede` lê só `atributos.PRS`. Falta decidir se o Poder deve ser rolado na geração.

**Ainda faltando no dado:** o dropdown de Dádiva do Painel (`area-npcs.js`) tem só as
cinco antigas e grava num campo que agora nada lê; o `eco.pericia` (texto livre) virou
paralelo ao `DADIVAS.pericia`, que lê a ficha. O Véu não existe em nenhum outro lugar
do código — o Redutor +2/+4 continua prosa.

**Curva de vale, sem correção pendente** (26/08): a entrega cai até o teto sem Aura e volta a
crescer com Aura (23 un → 5 → 18,5 com Aura III); o teto só corta atributos/perícias, então o
piso é ~5 un. Proposta de limitar resultados foi DESCARTADA — medido e registrado no §9.5.

**`functions/audit-texto-vs-motor.mjs`** — 81 invariantes texto×código (nº de Dádivas, fórmulas
da escalonada e da projeção, Redutor do Véu, campos mortos do Painel). Rodar junto com as
outras audits após mexer em Dádiva/Incorporação; se uma âncora sumir por reescrita legítima,
atualizar a âncora no mesmo commit.

**Why:** duas Dádivas sumiam e o Ancestral não funcionava, sem erro nenhum aparecer.
**How to apply:** mexeu em `DADIVAS`, roda `shared/dadiva.test.mjs` e o arnês.
Ver [[xama-duas-vertentes]] e [[nunca-hardcodear-regra-de-jogo]].
