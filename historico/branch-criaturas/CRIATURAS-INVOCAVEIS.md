# Criaturas invocáveis — especificação

Frente de Invocador, Adepto e Druida. Régua-mãe: `book-regua-balanceamento`
cap. 3 (invocação) e cap. 0 (linha de base). **1 unidade = 3,445 = uma rodada
de guerreiro no Q0.**

---

## 0. O que existe e o que falta

**Existe:** a fórmula de valor (Régua §3.1), os ritos que invocam (Invocação
Abissal, Erguer Fantoches, Reanimação, Convocar Manada, Vínculo Animal), a
infraestrutura de ficha (`npcs` com `criatura`, `aliadoProprio`, `valoresDer`,
`partesDoCorpo`; aba Aliados do jogador com Vit/Ener/San), e vocabulário de
design já usado nos ritos: **Disposição**, **Risco do Aspecto**, **AI da
criatura**, **Limite de Fantoches**.

**Falta:** as fichas (0 dos 88 NPCs é criatura invocável), o Bestiário (1
capítulo placeholder), a definição numérica de Disposição/Lealdade, e o VD
`Limite de Fantoches` (citado como requisito, nunca cadastrado).

---

## 1. O eixo unificado: p, a chance de agir por você

A Régua §3.1 já diz tudo:

```
valor = (2p − 1) × DPR_criatura × rodadas ÷ 3,445
```

Abaixo de p = 0,5 o invocador paga para ajudar o inimigo. O que esta espec
acrescenta: **p tem três nomes, um por classe** — e dois já existem no
vocabulário do banco.

| Classe | Nome do eixo | Escala | Quem move |
|---|---|---|---|
| Invocador | **Disposição** | 0–10 → p = Disposição ÷ 10 | Mestre gera em segredo; Laço de Nome dá ±1 |
| Druida | **Lealdade** | 0–10 → p = Lealdade ÷ 10 | convivência, trato, Ferinismo (eixo já decidido da Totemancia) |
| Adepto | — (fantoche não escolhe) | **p = 1 fixo** | o preço é pago em outra moeda: a criatura é fraca |

O mesmo dial, três leituras. Uma criatura de Disposição 7 e um lobo de
Lealdade 7 valem o mesmo na régua — o que muda é como se chegou ao 7.

---

## 2. Invocador do Abismo — a escada por CA

O cânone do rito manda: *"Reporte ao Mestre seu CA atual e os Graus — ele gera
a criatura em segredo. Quanto mais insano, maior e mais indócil o que
responde."* O invocador **não escolhe** o que vem: o CA dele escolhe.

Custo do rito: 4 Sanidade + 1 Energia = **5 pontos**. Criatura fica ~5 rodadas.

| CA ao invocar | Porte da resposta | DPR | Vit | Disposição base |
|---|---|---|---|---|
| 2–3 | Cria Menor | 3,4 (1,0×) | 12 | 5 (moeda ao ar) |
| 4–5 | Cria | 5,2 (1,5×) | 18 | 4 |
| 6–7 | Horror | 6,9 (2,0×) | 24 | 4 |
| 8–9 | Horror Maior | 8,6 (2,5×) | 30 | 3 |
| 10+ | Entidade | 10,3+ (3,0×) | 36+ | 2 |

### A conta que faz a classe funcionar

Break-even (valor = custo 5): `(2p − 1) × DPR × 5 ÷ 3,445 = 5`.

| Criatura | p necessário | Disposição necessária |
|---|---|---|
| Cria Menor (1,0×) | 1,00 | **10 — só dominada paga** |
| Cria (1,5×) | 0,83 | 8–9 |
| Horror (2,0×) | 0,75 | 7–8 |
| Horror Maior (2,5×) | 0,70 | **7 — dócil paga** |
| Entidade (3,0×) | 0,67 | 6–7 |

Leia de baixo para cima, porque é aí que a classe está: **invocar são é
prejuízo; invocar à beira do colapso é negócio.** A Cria Menor de CA 2 só se
paga dominada (Disposição 10 — dois Laços de Nome e interpretação); o Horror
Maior de CA 8 se paga dócil. A espiral de Sanidade que o soquete já definiu
(CA = ⌊Abismancia ÷ 2⌋ + décimos de Sanidade perdida) é também a espiral de
lucro — **e cada invocação custa 4 de Sanidade, que sobe o CA, que melhora a
próxima resposta.** A classe é uma aposta que melhora conforme se perde.

**Laço de Nome não é acessório:** +1 de Disposição por 1 Energia move p em
0,10, que vale `0,2 × DPR × 5 ÷ 3,445` — no Horror Maior, **2,5 unidades por
1 de custo**. É a melhor compra da classe, e é assim que ela deve ser jogada.

**Risco do Aspecto** (citado no redutor do Laço): cada criatura carrega um
Aspecto com Risco 1–3, que entra como redutor nos ritos de controle. Mantido
como knob do Mestre; a tabela acima assume Risco 1.

---

## 3. Adepto — fantoches e o servo

### Erguer Fantoches (1 Sanidade, todos os cadáveres no alcance)

p = 1, então o contrapeso é a carne fraca:

| | Fantoche |
|---|---|
| Alvo de ataque | 4 |
| Dano | 1d4 |
| Blindagem | 0 |
| Vitalidade | 6 (cai em ~2 golpes) |
| DPR | ~0,5 (0,15×) |
| Deslocamento | metade do humano |

Conferência: 3 fantoches × 0,5 × 5 rodadas ÷ 3,445 = **2,2 unidades por 1 de
Sanidade** — parece estourado, mas o DPR não é o produto real: fantoche morre
em 2 golpes e **cada golpe que ele come é um golpe que o grupo não comeu**.
O valor de tanque é autolimitado (morrem). A régua aceita porque o teto real é
o **Limite de Fantoches** e a matéria-prima: precisa de cadáver no chão.

**`Limite de Fantoches` — DECIDIDO:** `PRE + Perícia: Servos` (típico 6, teto
10). PRE é o atributo que governa a perícia Servos, e o dono do mundo pediu
limite bem maior que a perícia sozinha — dez fantoches no teto é um pequeno
cortejo fúnebre, e o gargalo real continua sendo cadáver no chão.

### Ritual de Reanimação (portão perícia 5, permanente)

O servo permanente não é invocação — é **companheiro**. Ver §5.

---

## 4. Druida — Manada e o Aliado

**Convocar Manada** é economia de cena (bichos pequenos: distração, busca,
alarme) — não se mede em DPR, mesma decisão dos ritos (Régua §3.3).

**Aliado Animal / Vínculo Animal / Fusão Selvagem** é companheiro permanente
com **Lealdade** como eixo — ver §5. A Fusão (Emissor/Receptor) não altera o
orçamento: muda quem pilota, não quanto se entrega.

---

## 5. A régua do companheiro permanente

Servo do Adepto, Aliado do Druida, e qualquer criatura que fique. Não paga
custo por cena — então não pode valer uma segunda classe inteira.

```
DPR do companheiro ≤ 0,6 × guerreiro  (≈ 2,1 no Q0)
mestre + companheiro juntos ≤ 1,4 × um marcial solo
```

| | Companheiro de referência (Q0) |
|---|---|
| Alvo de ataque | 5–6 |
| Dano | 1d6 + 1 |
| Blindagem | 1 |
| Vitalidade | 12–15 |
| DPR | ~1,9–2,1 |

O companheiro cresce com a **Lealdade/vínculo**, não com Luns — DECIDIDO:
**uma melhoria por ponto de Lealdade a partir de 6** (Lealdade 6 = 1ª, 10 =
5ª; teto 5). Cada melhoria compra +1 em um número (Alvo, dano fixo, Blindagem)
ou +3 de Vitalidade.

**Consequência declarada:** no teto (Lealdade 10, 5 melhorias todas em
ofensa), o companheiro chega a ~1,0× o guerreiro — o 0,6× é o piso de entrada,
não o teto. Aceito porque Lealdade 10 é meses de mesa, não compra; se dominar,
o corte é limitar a 2 melhorias em ofensa.

---

## 6. Onde as fichas moram

**Coleção `npcs`** — a infraestrutura existe (o Tabuleiro lê tokens de lá,
`npcNaMesa()` resolve vínculos, `aliadoProprio` marca posse). **Formato real,
conferido no banco:** `criatura` é OBJETO `{habitat, comportamento, dieta,
nivelAmeaca}` (19 NPCs já usam) · `ataques` é texto · `valoresDer` tem chaves
fixas `VIT/SAN/ENER/PERC/INI/REA/BLD/DESLOCAMENTO` · `tags` é string · `ai` é
número — e é o "AI da criatura" que o Laço de Nome cita como redutor.

NPC-modelo: `mesaId: ''`, `vinculos: []` (template de sistema, sem mesa),
`modoFicha: 'rapido'`, `visibilidade` do Mestre. Disposição base e Aspecto vão
em `criatura.nivelAmeaca` como texto padronizado. Bestiário (livro) é a
vitrine em prosa; a ficha jogável mora aqui.

---

## 7. Roster inicial — [NOMES A APROVAR]

Números fixados pelas tabelas acima; nomes são propostas (o cânone da Oitava
Camada e do Véu Terreno é do dono do mundo — nada aqui cria camada, história ou
hierarquia nova):

| Classe | Criatura | Tier |
|---|---|---|
| Invocador | Cria Menor do Véu · Cria da Fenda · Horror Rastejante · Horror Maior · Entidade da Oitava | CA 2 → 10 |
| Adepto | Fantoche (padrão) · Servo Reanimado (companheiro) | — |
| Druida | Lobo · Urso · Corvo · Serpente (companheiros, mesmos números com sabores) | — |

---

## 8. Decisões abertas (as suas)

1. **Limite de Fantoches = Perícia: Servos + 1?**
2. **Companheiro a 0,6× do guerreiro** com progressão por Lealdade — aprova?
3. **Disposição 0–10 com base por tier** (tabela §2) — aprova?
4. **Nomes do roster** (§7) — aprova, veta, ou manda os seus?

---

## 9. Doma e as feras pré-existentes (adendo)

O cânone do Vínculo Animal já mandava: **domar é universal — AUT + Domar, com
o Redutor da criatura**. O Redutor não existia em nenhuma ficha; agora existe,
na escada:

| Força da fera | Redutor de Doma | Lealdade mínima p/ vínculo |
|---|---|---|
| ≤ 0,6× guerreiro | −1 | 6 |
| ≤ 1,0× | −3 | 8 |
| > 1,0× | −5 | 10 |

**Fera acima do orçamento chega pronta:** as melhorias vêm pré-gastas (cada
~0,13× acima de 0,6× consome 1 do teto de 5). O Velocirops domado (~1,3×,
"Domável Hostil" desde o cadastro original) já é o que sempre vai ser.

Papa-Noite e Avarbus ficam indomáveis salvo decisão do Narrador. Os NPCs de
mesa (Gorren-Nhar, Sentinela, Ibirá) não foram tocados nem entram no Bestiário.
