# Condições — tabela final

Cadastradas em `system/data/conditions`. Valores em unidades da Régua
(`book-regua-balanceamento`), medidos por `functions/audit-condicoes.mjs`.
**1 unidade = 3,445 = uma rodada de guerreiro no Q0.**

## As nove

| Condição | Efeito numérico | Duração | Empilha | Valor |
|---|---|---|---|---|
| **Atordoado** 💫 | Perde o turno inteiro (Ação Padrão + Ação de Movimento) e a Reação até o início do próximo turno dele | 1 turno | não | **1,32** |
| **Cego** 🕶️ | Desvantagem em ataques e defesas · −4 no Alvo · não ataca quem não perceba | 1 cena | não (substitui Ofuscado) | 1,05 /rodada |
| **Prostrado** 🤕 | **+4** no Alvo de quem ataca em CaC · **−4** no Alvo de quem atira · levantar = 1 Ação de Movimento | até levantar | não | +0,47 CaC · −0,66 dist. |
| **Ofuscado** 🔆 | Desvantagem em ataques e defesas | 1 cena | não | 0,37 /rodada |
| **Agarrado** 🤼 | Deslocamento 0 · a única ação possível é tentar escapar · manter custa 1 Ação Padrão do agarrador/turno | enquanto pagar | não | **+0,33 /rodada** |
| **Amedrontado** 😱 | −1 no Alvo de todos os testes enquanto vir a fonte · não se aproxima dela voluntariamente | 1 cena | não | 0,17 /rodada (0,85 na cena) |
| **Lento** 🐌 | ½ Deslocamento · −2 Iniciativa | 1 cena | não | 0,10 /rodada |
| **Surdo** 🔇 | Desvantagem em Percepção Auditiva · falha automática no que dependa de ouvir · imune a efeito sonoral que exija escutar | 1 cena | não | ~0 em combate |
| **Exaustão** 😪 | Trilha 0–3 (ver abaixo) | até o Descanso Longo | sim, em níveis | economia de cena |

**Dissonância não é condição.** Era o contrapeso da Harmonia do Bardo e não
existe mais. O VD, a mecânica e o vínculo na classe foram removidos.

## Ancoragem no Livro de Regras

Seis das nove **já eram regra** — só não tinham nome de condição:

| Condição | Vem de |
|---|---|
| Atordoado | §6.9, manobra *Atordoar* |
| Prostrado | §6.10, *Luta no Chão* |
| Agarrado | §6.9, manobra *Agarrar* (a manobra existia, o efeito não) |
| Ofuscado | §6.10, escuridão **parcial** |
| Cego | §6.10, escuridão **total** |
| Exaustão | Cap. 2, *"ferimento grave ou exaustão: −1 a −3"* |

Consequência: nenhuma regra nova para o jogador decorar, e as magias passam a
apontar para o que já está impresso.

## Exaustão — a trilha

Mesma forma de Fome e Sede (§7.2), avaliada no ciclo de 24 horas.

| Nv | Estado | Efeitos |
|---|---|---|
| 0 | Descansado | — |
| 1 | Cansado | −1 no Alvo de todos os testes |
| 2 | Exausto | −2 no Alvo · ½ Deslocamento · o Teste de Descanso converte no máximo VIG graus em PR |
| 3 | Estafado | Efeitos de Exaustão 2 · não pode usar a Reação |

**Sobe:** Marcha Forçada com falha · 24h sem Descanso Longo · Fome ou Sede no nível 3 · efeito que declare.
**Desce:** −1 nível por Descanso Longo com pelo menos 1 grau no Teste de Descanso.

## O que o motor aplica sozinho

Só duas condições engatam num Valor Derivado de verdade:

- **Lento** → `Iniciativa −2` e os quatro `Desloc. ÷2`
- **Agarrado** → os quatro `Desloc. = 0`

As outras sete são texto do card, aplicado pelo mestre. Motivo: **não existe
Valor Derivado chamado "Alvo"** — ele é `Atributo + Perícia`, montado na hora
da rolagem. "−2 no Alvo de todos os testes" e "perde a ação" não têm onde
morar na ficha.

## Chance de Condição

Cada habilidade que aplique condição declara, **por condição**, uma **Chance de
1 a 10**. Se o golpe acertar, rola-se 1d10: **≤ Chance, a condição pega** — roll
under, igual a todo o resto do sistema.

A habilidade escolhe **um portão só**: Chance **ou** teste de resistência do
alvo. Nunca os dois — eles se multiplicam e esvaziam a condição.

### A Chance é desconto

```
valor da condição = (Chance ÷ 10) × valor cheio
```

É o botão para caber uma condição cara numa habilidade barata. Valor já
descontado:

| Condição | cheio | C=8 | C=6 | C=5 | C=4 | C=3 | C=2 |
|---|---|---|---|---|---|---|---|
| **Cego** (cena) | 5,23 | 4,18 | 3,14 | 2,61 | 2,09 | 1,57 | 1,05 |
| **Ofuscado** (cena) | 1,83 | 1,46 | 1,10 | 0,91 | 0,73 | 0,55 | 0,37 |
| **Atordoado** (1 turno) | 1,32 | 1,06 | 0,79 | 0,66 | 0,53 | 0,40 | 0,26 |
| **Amedrontado** (cena) | 0,85 | 0,68 | 0,51 | 0,43 | 0,34 | 0,26 | 0,17 |
| **Lento** (cena) | 0,50 | 0,40 | 0,30 | 0,25 | 0,20 | 0,15 | 0,10 |
| **Prostrado** | 0,47 | 0,38 | 0,28 | 0,24 | 0,19 | 0,14 | 0,09 |
| **Surdo** | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

### Em que custo cada uma cabe sozinha

| Condição | C=10 | C=8 | C=6 | C=5 | C=3 | C=2 |
|---|---|---|---|---|---|---|
| Cego | custo 5 | custo 4 | custo 3 | custo 2 | custo 1 | custo 1 |
| Ofuscado | custo 1 | custo 1 | custo 1 | — | — | — |
| Atordoado | custo 1 | custo 1 | — | — | — | — |
| Amedrontado · Lento · Prostrado · Surdo | — | — | — | — | — | — |

"—" não é veto: é sinal de que a condição precisa vir junto de dano, de mais
alvos ou de mais rodadas (Régua §1.3).

### Várias condições na mesma habilidade

Soma dos valores já descontados, cada uma com a sua Chance:

```
Cego C=3 + Amedrontado C=6   = 2,08 un / custo 2  → 1,04:1  ✅
Lento C=10 + Prostrado C=5   = 0,74 un / custo 1  → 0,74:1  ❌
Surdo C=10 + Atordoado C=4   = 0,53 un / custo 5  → 0,11:1  ❌
```

### O teste de resistência não é desconto

O alvo resiste com `1d10 ≤ (Atributo + Perícia − Graus do conjurador)`. Contra
um conjurador com 2 Graus:

| Alvo resiste com | P(resistir) | equivale a |
|---|---|---|
| AUT 3, sem perícia | 0,10 | **Chance 9** |
| AUT 3 + perícia 2 | 0,30 | **Chance 7** |
| AUT 5 + perícia 3 | 0,60 | **Chance 4** |

Os Graus do conjurador comem o Alvo do alvo, então o teste típico é uma Chance
8 a 9 disfarçada — quase sempre pega. **Quem quer desconto usa Chance;** o
teste serve para premiar quem investiu no atributo defensivo.

## O que isso reprova nas magias

| Magia | Custo | Problema |
|---|---|---|
| GRITO DISSONANTE | 1 | `−1 no Alvo` em área **+** Atordoado. Só o Atordoado (1,32) já estoura o orçamento de 1,00 |
| MARCHA DO CATACLISMO | 4 | texto diz "Prostrado, −2 no Alvo, perde a próxima ação" — não é o Prostrado do §6.10 |
| LAMENTO DA BANSHEE | 4 | "Amedrontado + −2 no Alvo" — o Amedrontado já é −1; definir se soma ou substitui |
| TROMBETA DO JULGAMENTO | 5 | Surdo + Atordoado juntos; o Surdo vale ~0 em combate, o Atordoado carrega tudo |
| ONDA DE CHOQUE SONORAL | 3 | "teste de VIG ou Atordoado" — teste de resistência, então **sem** Chance por cima |
| Luz da Vontade I / Cegueira da Fé I | — | citam "ofuscamento/cegueira leve"; agora há dois nomes exatos, Ofuscado e Cego |

## Scripts

| Script | O que faz |
|---|---|
| `audit-condicoes.mjs` | preço de cada condição contra a Régua; asserts reproduzem o 0,53 / 3,445 do §0.2. Não toca no banco |
| `cadastrar-condicoes.mjs` | grava as nove + as 2 mecânicas. `--dry-run` / `--apply` |
| `remover-dissonancia-e-soco.mjs` | apaga Resistir Dissonância (VD + mecânica + 4 fichas + classe Bardo) e a mecânica órfã Soco |

---

# Paleta por Essência

28 condições no total: as 9 de sistema (acima) mais 19 ligadas às Treze
Essências. **Regra da casa: não se cria condição de mesmo sentido.** A
identidade da Essência mora no **par** (negativa, positiva), não em ter
condição exclusiva — por isso Terra e Natureza dividem *Imobilizado*, e Vento
e Espaço dividem *Desorientado*, sem que nenhuma das duas duplas deixe de ser
distinta. Os 13 pares são únicos; as negativas são 11.

| Essência | Função tática | Negativa | un/rod | Positiva | un/rod |
|---|---|---|---|---|---|
| **Fogo** 🔥 | escalar — piora se ignorado | Queimadura N | 0,58 | Inflamado | 0,00 |
| **Vento** 🌬️ | tirar e dar o pé no chão | Desorientado | 0,69 | Acelerado 1 | 0,10 |
| **Terra** ⛰️ | travar o chão, dos dois lados | Imobilizado | 0,69 | Inabalável | 0,21 |
| **Água** 💧 | sufocar e limpar | Afogando 2 | 0,58 | Purificado | var. |
| **Vida** 💙 | somar teto de Vitalidade | *nenhuma* | — | Vigorado N | 1,16 |
| **Natureza** 🌿 | devolver ao longo do tempo | Imobilizado | 0,69 | Simbionte N | 0,58 |
| **Necrótica** 💜 | tirar teto de Vitalidade | Definhado N | 1,16 | Reanimado N | 1,16 |
| **Luz** ☀️ | apagar o sentido | Cego | 1,05 | Consagrado | 0,15 |
| **Espaço** 🧭 | quebrar a geometria | Desorientado | 0,69 | Ancorado | 0,33 |
| **Tempo** ⏳ | economia de ações, dois sentidos | Atordoado | 1,32 | Acelerado 3 | 1,43 |
| **Cristal** 💎 | esvaziar ou dobrar a Essência alheia | Opaco | ~0,50 | Amplificado | 1,16 |
| **Abissal** 🕳️ | corroer sem volta | Corrompido N | 0,51 | Vennire N | 0,34 |
| **Poder** ⚡ | imitar e amplificar — com juros | Sobrecarregado | 0,71 | Amplificado | 1,16 |

## As quatro oposições se cancelam de graça

O compêndio declara Vento×Terra, Água×Fogo, Vida×Necrótica e Luz×Abissal.
Três dos quatro pares já se desfazem sozinhos, sem regra nova:

```
Vento × Terra      Acelerado (Desloc ×2)  ×  Inabalável (Desloc ½)
Água  × Fogo       Purificado remove condição  ×  Queimadura É condição
Vida  × Necrótica  Vigorado (VIT Máx +N)  ×  Definhado (VIT Máx −N)
Luz   × Abissal    Consagrado blinda contra Abissal  ×  Corrompido só sai com Luz
```

**Regra proposta (não cadastrada):** opostas se cancelam nível a nível, sem rolagem.

## Três travas que seguram a régua

**Acelerado Nv 3 dura 1 turno, nunca 1 cena.** Ação extra é 1,000/rodada
(§1.1). Numa cena valeria 7,15 un — mais que todas as outras positivas somadas.

**Amplificado tem teto de +4 por canal.** Dobrar é multiplicador, e a Régua é
linear: sem teto vale 1,89 un/rodada no Q0 e 5,66 no Q5, crescendo com a
Qualidade e concentrando poder em quem já é o mais forte.

**Opaco corta pela metade, não zera.** Zerar apagava o turno de um conjurador
e não fazia nada contra um guerreiro. Ainda é a condição de maior variância do
sistema (0,00 a ~1,00 conforme o alvo) e a Régua não sabe medir isso.

## O que o motor aplica sozinho

Das 28, quatro engatam num Valor Derivado:

| Condição | Mecânica |
|---|---|
| Lento | `Iniciativa −2` · 4× `Desloc. ÷2` |
| Agarrado · Imobilizado | 4× `Desloc. = 0` (mecânica compartilhada) |
| Acelerado (Nv 1) | `Iniciativa +2` · 4× `Desloc. ×2` |
| Inabalável | `Blindagem +2` · 4× `Desloc. ÷2` |
| Consagrado | `Blindagem Necrótica +2` · `Blindagem Abissal +2` |

O resto é texto do card. Não existe VD "Alvo" — ele é `Atributo + Perícia`,
montado na rolagem.

## Aberto

- **Afogando** — o dano (2/rodada) está medido; o peso de "não pode falar"
  depende de quantas magias exigem componente verbal, e não foi levantado.
- **Vennire alimenta a catraca da Abismancia.** Pela §4.5, gastar Sanidade
  *sobe* a Conexão com Abismo. Ficar instável deixa mais forte, o que deixa
  mais instável. Coerente com o cânone, mas é loop de reforço.
- **Corrompido só sai com Luz** — hard counter por composição de grupo.
- **Inflamado dá 0,00 líquido** — troca de variância, que a Régua §4.6 não mede.
- **Acelerado 1 e Ancorado** herdam âncoras estimadas (Deslocamento 0,10 e
  reposicionar 0,333), nenhuma das duas derivada. Ver §5.3 e §6.9.
- **Vida sem negativa** — decisão de design: a única Essência que não machuca.
