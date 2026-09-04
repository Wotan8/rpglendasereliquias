---
name: cascata-de-altura-nos-derivados
description: "Altura é a raiz dos Valores Derivados — mexer nela move Tamanho, Peso, Vitalidade, Carga, Deslocamento e Iniciativa sozinha"
metadata: 
  node_type: memory
  type: project
  originSessionId: dd0a8d9b-633c-4d84-b6e5-f9cb2e561e64
  modified: 2026-07-28T12:54:16.284Z
---

As fórmulas dos Valores Derivados encadeiam a partir da **Altura** (constante da raça,
`XPv2i5GhoHfz2QSH3pCl`, ex. Humano 1,70 · Yotun 5,25):

```
Altura
 ├─ Tamanho          = Altura × 3
 │   ├─ Vitalidade Máx = (VIG + Tamanho) × 3
 │   ├─ D.Terrestre    = FOR + DES + Agilidade + Tamanho
 │   ├─ D.Aquático     = FOR + VIG + Atletismo − Tamanho ÷ 2
 │   └─ Iniciativa     = AUT + RAC + DES + Agilidade − Tamanho
 └─ Peso             = (18 + FOR + VIG) × Altura²
     └─ Carga         = (FOR + VIG) × Peso ÷ 10
```

**Why importa:** uma única mecânica de `×%` na Altura propaga por tudo isso. Cadastrar
"Peso +5%" junto de "Altura +10%" é **contar duas vezes** — a quadratura já dá +21% de
Peso. Idem D.Terrestre, D.Aquático e Iniciativa: reagem sozinhas ao Tamanho. O que
**não** depende de tamanho e precisa de mecânica própria: **D.Vertical**
(= menor entre FOR e Atletismo) e **Percepção Visual** (= RAC + Observação).

Referência de grandeza (Humano FOR/DES/VIG 2): +10% de Altura ≈ +1 Vitalidade,
+5 Carga, +13 kg. A Carga é **quadrática** na Altura, então o ganho acelera por nível —
por isso [[padrao-peculiaridades-avulsas]] cobra 5/10/15 EXP no Gigantismo em vez de
um custo fixo. Compare com atributo: 1 ponto de VIG custa `nível × 5` EXP e dá +3 Vit.

**Efeito colateral aceito:** Peso alimenta Carga, então qualquer peculiaridade que
engorda (Corpulento, Glutão) *aumenta* quanto o personagem carrega. É coerente
(corpo maior = mais massa útil) e o preço é o −Deslocamento; mas nunca conceda EXP
por engordar, senão vira almoço grátis.

**Ordem de cálculo (corrigida em 28/07/2026):** a constante de Raça/Classe/Tribo entra
como BASE, *antes* dos modificadores gerais — antes disso um `×1,1` na Altura
multiplicava 0. Ver `_applyMechanicModifiers` em `ficha-v1.7_1/js/derived-values.js`
(parâmetro `baseExtra`) e as 4 passadas de `simulateDerivedValues` em
`criar-personagem/js/mechanics-simulator.js`, que existem porque refs a outro VD leem
o snapshot da passada anterior. Regressão coberta por
`criar-personagem/js/mechanics-simulator.test.mjs`.
