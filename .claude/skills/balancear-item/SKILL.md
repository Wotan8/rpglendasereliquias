---
name: balancear-item
description: Balanceia armas, armaduras e escudos de Lendas e Relíquias pelo modelo de combate do sistema. Use ao criar item novo com potência-alvo ("cria uma espada que começa com +4 de Dano", "uma armadura que aguente arma de +4"), ao auditar item já cadastrado ("balanceia a Armadura X, o arnês completo dela deve dar +4 de Blindagem"), ou ao decidir Blindagem, dado de dano, cobertura de slots e classe de material de qualquer equipamento.
---

# Balancear item — Lendas e Relíquias

Modelo fechado em 29/07/2026. Ele existe para uma coisa: manter a **janela letal**
estável enquanto o catálogo cresce, usando só subtração (nunca porcentagem — a
mesa precisa resolver de cabeça em um turno).

## 1. As constantes do sistema

**Sempre confirme no Firestore antes de calcular** — os números abaixo são de
29/07/2026 e o catálogo muda. Use o padrão de leitura da seção 7.

```
Vitalidade Máxima = (VIG + Tamanho) × 3          Tamanho = Altura × 3
Dano (VD base)    = FOR
Acerto            = (FOR max DES) + Perícia: Arma
Blindagem         = subtrai direto do dano recebido
```

| | Valor na criação |
|---|---|
| Teto de atributo | **3** (1 base + 2 distribuídos) |
| Teto de perícia | **3** |
| Vitalidade — Picxi / Humano / Yotun | **19 / 24 / 56** |
| Dados de arma no catálogo | 1d4 a 1d12 |
| **Golpe médio de personagem novo** | **1d8 + FOR 3 = 7,5** |

**Referência de corpo (Humano):** 11 partes, 21 slots.
Cabeça 1 · Pescoço 1 · Torso 1 · Costas 1 · Ombro 2 · Braço 2 · Cintura 1 ·
Pernas 2 · Pé 2 · Mão 2 · Dedos 6.

**Slots protegíveis = 15** (os 13 de armadura + as 2 Mãos). Dedos não contam.

## 2. Melhorias: as duas oficinas

| Quem | Arma | Armadura | Taxa |
|---|---|---|---|
| **Ferreiro** | Afiação | Reforço | +5 por tier |
| **Forjarcanista** | Afiação mágica | Resistência mágica | +5 por tier |

Empilham. Tier = `liga` do item, 0 a 5. Então cada lado chega a **+10 por tier**.

- **Arma:** `+10T` no item. Uma arma, um bônus.
- **Proteção:** `+0,67 por slot coberto por tier` (0,33 ferreiro + 0,33 forjarcanista).
  Vem de `10 ÷ 15 slots protegíveis`.

**Por que o 0,67 e não +10 por peça:** a melhoria é por slot coberto, igual à
Blindagem base. Reforçar um arnês de 13 slots rende o mesmo que reforçar 13 peças
avulsas de 1 slot. É o que torna a montagem irrelevante e o total impossível de
explorar.

## 3. As quatro invariantes — nunca quebre

1. **Blindagem é sempre por slot coberto, nunca por item.** Base e melhoria, a
   mesma regra. Um peitoral que cobre 4 slots vale 4 slots, não "um peitoral".
2. **O denominador da melhoria inclui TODO slot protegível, mãos inclusive.**
   Deixar um de fora torna preenchê-lo escalada de graça — foi o que fazia
   arnês+escudo voltar a zero no tier 5.
3. **Nenhuma combinação pode chegar a zero.** Piso de dano **1** por golpe que
   acerta. Só importa em descasamento grande de tier, e é o que transforma
   "impossível" em "24 golpes".
4. **As melhorias se cancelam entre tiers.** `(dado+FOR+10T) − (base+10T)` = o
   `10T` sai da conta. Logo **a progressão real mora nos valores naturais** —
   dado maior, cobertura maior, material melhor. Afiação é manutenção para não
   ficar atrás, não fonte de poder.

## 4. Blindagem base — a taxa por classe

As tags `Leve` / `Média` / `Pesada` já existem no catálogo e definem a taxa:

| Classe | Blindagem por slot coberto |
|---|---|
| Leve | **0,15** |
| Média | **0,22** |
| Pesada | **0,30** |

`Blindagem base = taxa × slots cobertos`

Escudos ficam fora da taxa — são defesa ativa num slot de Mão que competiria com
arma, então levam valor cheio: **Torre 1,2 · Grande 0,9 · Médio 0,6 · Broquel 0,3**.

Guarde fracionado. **Arredonde para baixo só o total** na hora de usar na mesa.

## 5. A janela letal — o alvo de todo cálculo

```
passa(T)  = (dado_médio + FOR + dano_natural + 10T) − (Bl_base + 0,67 × slots × T)
golpes    = Vitalidade ÷ max(1, passa)
```

Referência contra Vitalidade 24, arma e proteção **no mesmo tier**. Cobertura
completa = 13 slots; Bl base sai da taxa da seção 4 (`taxa × 13`):

| Proteção | Bl base | tier 0 | tier 3 | tier 5 |
|---|---|---|---|---|
| nu | 0 | **3,2** | 0,6 | 0,4 |
| Leve completa | 1,95 | 4,3 | 2,5 | 2,0 |
| Média completa | 2,86 | 5,2 | 2,8 | 2,1 |
| Pesada completa | 3,90 | **6,7** | 3,2 | 2,3 |
| Pesada + Escudo Torre | 5,10 | 10,0 | 5,5 | 4,2 |

**Calibre sempre no tier 0** — é onde os valores naturais mandam. A deriva para
os tiers altos é esperada e intencional: o combate fica mais mortal conforme o
equipamento sobe, porque o `+10T` da arma é ligeiramente maior que o
`0,67 × 13 = 8,7T` da armadura de corpo. Só o escudo (que adiciona slot sem
adicionar dano) segura essa deriva.

**Faixa aceitável no tier 0: 3 a 10 golpes.** Abaixo de 3 é morte sem decisão;
acima de 10 o combate não resolve. Fora dessa faixa, avise e ajuste.

Descasamento de tier é onde mora o perigo, **e isso é desejado**: arma 3 contra
proteção 0 mata em 0,7 golpe; arma 0 contra proteção 3 leva 24. Quem está mal
equipado morre — não a rolagem.

## 6. Os três pedidos e como resolver cada um

### A) "Cria uma arma que começa com +N de Dano natural"

1. `dano_natural = N`. Escolha o dado pela categoria (uma mão 1d6–1d8, duas mãos
   1d10–1d12, distância 1d4–1d10).
2. Rode a janela contra **Pesada completa (3,9)** e contra **nu (0)**, no tier 0.
3. Confira a faixa de 2 a 10.

Exemplo — espada de uma mão, 1d8, +4 natural:
`passa = 4,5 + 3 + 4 − 3,9 = 7,6` → `24 ÷ 7,6 = 3,2 golpes` contra armadura
pesada completa. Ou seja: **um +4 natural faz armadura pesada valer o mesmo que
pele nua contra uma arma comum.** É arma de nível alto — sinalize isso, e
confirme que é a intenção antes de cadastrar.

### B) "Cria uma armadura que aguenta arma de +N de dano natural"

Resolva para trás, escolhendo quantos golpes quer aguentar (use 4 se o usuário
não disser):

```
passa_desejado = Vitalidade ÷ golpes_desejados
Bl_base        = dado_médio + FOR + N − passa_desejado
taxa_por_slot  = Bl_base ÷ slots_cobertos
```

Compare a `taxa_por_slot` com a tabela da seção 4:
- ≤ 0,30 → cabe em `Pesada`, cadastre normal.
- \> 0,30 → **excede a melhor classe existente**. Avise: ou é material novo (crie
  uma classe acima de Pesada e diga qual taxa), ou é peça única/mágica, ou a
  cobertura precisa ser maior. Não invente classe sem avisar.

### C) "Balanceia a armadura X do site, o arnês completo dela deve dar +N"

1. Leia o item no Firestore (seção 7): `tags`, `equipavelEm`, `slotsAdicionais`,
   `valoresDerivadosVinculados`.
2. Descubra a cobertura: `slots = 1 (principal) + soma das quantidades de slotsAdicionais`.
   Se `slotsAdicionais` estiver vazio mas o item for armadura de corpo, **é isso
   que está faltando** — proponha a cobertura antes de mexer na Blindagem.
3. `taxa = N ÷ slots`. Confira contra a seção 4 e reporte a classe implícita.
4. Rode a janela e mostre os golpes antes e depois.
5. Só grave depois de aprovação, com dry-run primeiro.

## 7. Como ler e gravar

Padrão de acesso ao Firestore (copie de `functions/audit-tribos.mjs`):

```js
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
  require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const grab = async c => (await db.collection(`system/data/${c}`).get())
  .docs.map(d => ({ id: d.id, ...d.data() }));
```

**Sempre `--dry-run` primeiro, imprimindo o que vai mudar. Só grave com aprovação
explícita.** Scripts vivem em `functions/`.

Campos de `system/data/equipment` que importam:

| Campo | Uso |
|---|---|
| `formulaDano` | string do dado: `"1d8"`, `"1d8 / 1d10"` (versátil) |
| `valoresDerivadosVinculados` | `[{id: <id do VD Blindagem>, modificador: N}]` — **busque o id por nome**, não hardcode |
| `equipavelEm` | slots principais válidos (`bodyParts`) |
| `slotsAdicionais` | `[{id: parteId, quantidade: N}]` — cobertura além do principal |
| `tags` | inclua `Leve` \| `Média` \| `Pesada` (+ graduada `Média II` etc.) ou `Escudo` |
| `liga` | 0 a 5 — o tier |
| `atributosVinculados` | modificadores de atributo ao equipar (ex. −3 Destreza) |
| `periciasVinculadas` | modificadores de perícia ao equipar (ex. −5 Furtividade) |

A lógica de ocupação de slot é compartilhada em `shared/equip-slots.js` (reserva
tudo-ou-nada). Penalidade de armadura pode morar na própria peça via
`atributosVinculados`/`periciasVinculadas` — não crie mecânica só para somar.

## 8. Refs em mecânica: o prefixo é obrigatório

Ao escrever qualquer mecânica que leia perícia, use **`"Perícia: X"`**, nunca o
nome puro. Existem 8 nomes que são perícia **e** valor derivado ao mesmo tempo
(`Abismancia`, `Alquimancia`, `Contracanto`, `Dosagem`, `Ecos do Vazio`,
`Empatia Sanguínea`, `Exorcismo`, `Vozes do Túmulo`). Sem o prefixo, o motor casa
com o VD homônimo e lê o número errado **em silêncio**.

## 9. Sempre reporte junto

Ao entregar um item, mostre:

1. A conta da janela — golpes contra nu, Média completa e Pesada completa.
2. A classe de material implícita pela taxa por slot, e se ela excede o catálogo.
3. Se cair fora da faixa de 2 a 10 golpes, diga e proponha o ajuste.
4. O que ficou de fora (cobertura não declarada, penalidade não cadastrada).
