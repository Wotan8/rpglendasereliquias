---
name: cura-de-item-via-statusvitais
description: "Consumíveis que afetam Vitalidade/Sanidade/Energia usam o campo statusVitaisVinculados no item, não mais uma mecânica vinculada — usar as duas juntas duplica o efeito"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5898b59d-2528-423c-985e-d99a793e3a9f
  modified: 2026-07-29T15:14:06.261Z
---

Itens (equipment/items) que curam ou drenam um status vital ("Atual") **não devem mais
usar uma mecânica vinculada** (`mecanicaIds`/`mecanicaIdsProprias` apontando pra uma
mecânica `tipo: modificar`, `alvo: "Vitalidade Atual"` etc). O padrão atual é o campo
dedicado no próprio item:

```js
statusVitaisVinculados: [{ id: "VIT_ATUAL", modificador: 4 }]
// ids possíveis: VIT_ATUAL, SAN_ATUAL, ENER_ATUAL (curam/drenam ao "Usar")
//                VIT_MAX, SAN_MAX, ENER_MAX (bônus passivo de equipar, não some ao usar)
```

**Why:** eu criei a "Loção de cura 2 (+4)" com uma mecânica dedicada (`KKVvbKrwOEvbrg9Lfqim`,
alvo "Vitalidade Atual"). O usuário/outra sessão migrou o item pra `statusVitaisVinculados`
(ver `functions/vincular-status-locao.mjs`) porque esse é o mecanismo suportado agora —
`ficha-v1.7_1/js/inventory.js` (`window.usarItem`) lê `statusVitaisVinculados` direto, com
clamp em `[0, Máximo]`. A mecânica antiga não foi apagada (fica de referência), só
desvinculada do item — **mas as duas instâncias que eu tinha criado direto no inventário
de NPCs (Raknar e Vexia) ainda carregavam a mecânica antiga em `mecanicaIdsProprias`**,
então ao usar o item elas curariam +8 (mecânica +4 rodando como one-off **e**
`statusVitaisVinculados` +4 herdado do catálogo via `modeloId`, somados). Corrigido em
29/07/2026 zerando `mecanicaIdsProprias` nas duas instâncias.

**How to apply:** ao cadastrar qualquer novo consumível de cura/dreno, usar
`statusVitaisVinculados` desde o início, e **não** vincular mecânica junto. Se um item
antigo tiver os dois ao mesmo tempo, é bug de duplicação — zerar `mecanicaIdsProprias`
(ou `mecanicaIds` do catálogo) e deixar só `statusVitaisVinculados`. Instância sem
`statusVitaisVinculados` próprio herda do catálogo via `modeloId` — não precisa duplicar
o campo na instância se o modelo já tem.

Relacionado: [[limitacao-dano-nao-estruturado]]
