# Alquimancia — sistema de loções

Especificação lógica. **Não é texto de mesa** — é a matemática que o
`/redator-tecnico-rpg` documenta e o `/coescritor` traduz para o livro.

Frente de Druida e Caçador. Régua em `book-regua-balanceamento` (não público).

---

## 0. O que existe hoje, e o que falta

**Existe:** oito propriedades nomeadas — **Toxis · Metanox · Dissolvix ·
Sentinox · Vitalis · Regebolis · Caltra · Metabolis** — cada uma com potência
numérica. Oito receitas cadastradas, todas de potência total **2**. O campo
`Dificuldade de Macerar` já é definido como *"soma total de pontos de
propriedade"*.

**Não existe:** os ingredientes. Uma única "Babosa" tagueada `Matéria`, e
**nenhum item do catálogo carrega propriedade alquímica**. As receitas exigem
`Toxis 2` e não há no mundo nada que tenha Toxis.

**Consequência:** não é reforma de um sistema em uso — é fechar um sistema que
nunca teve como rodar. A boa notícia é que o vocabulário e a régua de
dificuldade já estão certos e ficam.

---

## 1. A restrição que define tudo: loção é pastosa

Pasta não espirra, não evapora, não se bebe de gole. **Ela adere.**

| Consequência mecânica | Por quê |
|---|---|
| **Nenhuma loção tem área** | pasta não se dispersa |
| **Entrega por contato** | untar arma, untar projétil, passar na pele, tratar ferida, cobrir superfície |
| **Aplicar custa 1 Ação Padrão** | como toda habilidade (Livro §6.2) |
| **Fica onde foi posta** | uma arma untada carrega a loção até descarregar |

Isso separa a Alquimancia da magia de área por construção, e não por regra
arbitrária. O alquimista é preciso, não amplo.

**Formas de entrega** (a receita declara qual):

| Forma | Alvo | Descarga |
|---|---|---|
| **Unção de arma** | quem a arma acertar | os 3 próximos acertos |
| **Unção de projétil** | quem o projétil acertar | 1 acerto |
| **Aplicação em pele** | você ou um aliado tocado | imediata |
| **Tratamento de ferida** | um alvo caído ou tocado | imediata |
| **Cobertura de superfície** | quem tocar a superfície | primeiro contato |

---

## 2. A conversão: potência → efeito

**Âncora:** `1 ponto de propriedade = 0,50 unidade da Régua`.

De onde sai: as oito receitas existentes têm potência total **2**, e aplicar
uma loção custa **1 Ação Padrão = 1,00 unidade**. Potência 2 empatando com o
ataque que você deixou de fazer é exatamente o ponto de equilíbrio — o autor
das receitas já tinha calibrado isso sem escrever a conta.

### O que 1 ponto compra

| Moeda de efeito | 1 ponto |
|---|---|
| Dano ou cura imediata | **2** |
| Dano por rodada | **1**, durante 2 rodadas |
| ±1 no Alvo | **3 rodadas** |
| +1 de Blindagem | **3 rodadas** |
| Lento | **1 cena** |
| Amedrontado | **3 rodadas** |
| Ofuscado | **1 rodada** |
| Queimadura | **1 rodada** |

### Condições pesadas custam mais que 1 ponto

| Condição | Pontos |
|---|---|
| Cego, 1 rodada | **2** |
| Atordoado, 1 turno | **3** |

*(Valores conferidos contra `system/data/conditions`: Lento 0,10/rod ·
Ofuscado 0,37/rod · Amedrontado 0,17/rod · Cego 1,05/rod · Atordoado 1,32.)*

---

## 3. As oito propriedades

Cada uma tem **família** (que governa a amplificação) e um efeito próprio por
ponto de potência **P**.

| Propriedade | Família | Efeito com potência P |
|---|---|---|
| **Toxis** | Ofensiva | 1 de dano por rodada, durante 2P rodadas (teto: a cena) |
| **Dissolvix** | Ofensiva | −P de Blindagem do alvo por 1 cena; em objeto, corrói |
| **Metanox** | Sensorial | Lento por 1 cena (P≥1) · também −1 no Alvo por 1 cena (P≥2) · também Atordoado 1 turno (P≥3) |
| **Sentinox** | Sensorial | Ofuscado por P rodadas · Cego por ⌊P÷2⌋ rodadas |
| **Vitalis** | Vital | cura P+1 imediato |
| **Regebolis** | Vital | cura 1 por rodada, durante 2P rodadas |
| **Caltra** | Vital | remove P níveis de condição ou veneno |
| **Metabolis** | Metabólica | +1 no Alvo por 3P rodadas |

**Nenhum nome novo.** As oito são as que já estão nas receitas.

---

## 4. As três formas de combinar

### 4.1 SOMA — mesma propriedade

Potências se somam. `Toxis 1 + Toxis 1 = Toxis 2`.

É o caso trivial e é como o alquimista aumenta a força de um efeito só.

### 4.2 AMPLIFICAÇÃO — mesma família

Duas propriedades **da mesma família** na mesma loção: **uma delas, à escolha do
alquimista, ganha +1 de potência**, e a **Dificuldade sobe +2**.

```
Vitalis 1 + Regebolis 1  →  amplifica Vitalis
  → Vitalis 2 (cura 3) + Regebolis 1 (1/rodada por 2 rodadas)
  → Dificuldade 2 + 2 = 4
```

A amplificação é paga: 1 ponto de efeito extra por 2 de Dificuldade. Cara de
propósito — sem esse preço, misturar famílias vira a jogada óbvia e o sistema
colapsa numa receita só.

> É por isso que a *Loção de Cura Rápida* mistura Vitalis 1 e Regebolis 1 em vez
> de usar Vitalis 2: por 2 de Dificuldade a mais, ela cura de duas maneiras — de
> uma vez e ao longo do tempo.

### 4.3 REAÇÃO — pares que viram outra coisa

Certos pares **não somam nem amplificam: as duas propriedades somem e nasce um
efeito terceiro**, com potência igual à **menor das duas, +1**.

Reação tem prioridade sobre amplificação. É irreversível dentro da loção — não
dá para extrair os componentes depois.

| Par | Nome proposto | Potência | Efeito |
|---|---|---|---|
| **Toxis + Metanox** | **Beijo de Chumbo** | menor +1 | Paralisia: Atordoado por 1 turno; com P≥4, 2 turnos |
| **Sentinox + Metanox** | **Pavor-Cego** | menor +1 | Amedrontado por 3P rodadas, e não distingue aliado de inimigo |
| **Toxis + Dissolvix** | **Água-Forte** | menor +1 | 2 de dano por rodada por 2P rodadas, e ignora Blindagem |
| **Vitalis + Metabolis** | **Sangue-Novo** | menor +1 | cura 2P **e** +1 no Alvo por 3P rodadas |
| **Regebolis + Caltra** | **Lava-Chagas** | menor +1 | cura 1/rodada por 2P rodadas **e** remove P condições |
| **Dissolvix + Caltra** | **Cal-Morta** | menor +1 | anula toda loção e veneno no alvo; P de dano em construto |

Nomes na lógica do boticário — a coisa é batizada pelo que faz ou pelo que
lembra, e três são nomes reais de ofício (água-forte é o ácido dos gravadores,
cal-morta é a cal apagada, beijo de chumbo é o envenenamento saturnino que
entorpece). **Aprovados pelo dono do mundo — são cânone.**

**O par produz mais que a soma dos dois** — é a recompensa por acertar a
combinação. E produz **menos que as duas separadas em potência cheia**, porque
usa a menor +1 — é o custo de tentar. Duas loções já cadastradas no catálogo
(*Loção Paralisante I*, *Loção de Medo I*) são os dois primeiros pares — a
estrutura já estava lá implícita.

---

## 5. A receita

Uma receita declara, e nada mais:

| Campo | O que é |
|---|---|
| `propriedades` | quais e em que potência mínima |
| `variedadeMinima` | quantos ingredientes **diferentes** precisam trazer a propriedade |
| `repetirIngrediente` | se o mesmo ingrediente pode entrar duas vezes |
| `formaEntrega` | unção de arma / projétil / pele / ferida / superfície |
| `dificuldade` | **derivada**: soma das potências + 2 por amplificação |

### O teste

```
Alvo de Macerar = RAC + Perícia: Herbalismo + Perícia: Maceração   (cânone do Compêndio)
redutor = Dificuldade
```

**Graus de Sucesso = doses produzidas.** Falha estraga os ingredientes; falha
crítica produz uma loção de efeito invertido — e é assim que se descobre par
novo, na marra.

### Criação livre

O alquimista **não precisa de receita** para tentar. Sem receita:

- ele escolhe os ingredientes e o mestre soma as propriedades
- a Dificuldade é a mesma conta
- **o redutor tem −3 adicional** por estar improvisando
- se der certo, a receita passa a existir para ele

É isso que torna o sistema "criar do jeito que preferir": a receita é
**registro de algo que deu certo**, não pré-requisito.

---

## 6. Ingredientes — o que precisa ser criado

Um ingrediente é um item (`tipo: Consumível`, tag `Matéria`) que carrega **1 a 3
propriedades**, cada uma com potência **1 a 3**.

```
Babosa            Vitalis 1 · Regebolis 1
Raiz de <?>       Toxis 2
Fungo de <?>      Metanox 1 · Sentinox 1
```

**Regra de balanceamento do ingrediente:** a soma das potências que ele carrega
determina raridade e preço. Um ingrediente de soma 4 é achado de expedição, não
de mercado.

| Soma de potências | Onde se acha |
|---|---|
| 1 | comum, mercado |
| 2 | incomum, herborista |
| 3 | raro, coleta específica |
| 4+ | expedição ou favor |

**Decidido pelo dono do mundo:**

- **Plantas**: infinitas; podem vir da vida real e de histórias sem plágio
  (mandrágora, beladona, cicuta, visco, losna…). Criar livremente.
- **Essências**: loção usa **qualquer Essência que tenha planta ou mineral com
  afinidade** — Natureza e Cristal na frente, Necrótica e as demais atrás.
  Um fungo de catacumba carrega Toxis *e* canal Necrótico.
- **Minerais**: pó de cristal é ingrediente. O Compêndio de Cristalomancia
  (`book-cristalomancia`, criado nesta frente) define as pedras: cinábrio →
  Toxis mineral, sal-gema → Caltra, e **pó de cristal de afinidade dá canal de
  Essência à loção** — dano tipado contra a Blindagem daquela Essência, na
  régua de dano por barreira. A trava econômica é o preço: moer cristal é
  queimar dinheiro.

---

## 7. Conferência contra a Régua

**Faixa alvo: uma dose entrega entre 1,00 e 2,00 unidades.** Piso porque aplicar
custa a Ação Padrão; teto porque loção é consumível e não pode substituir a
classe inteira.

| Loção | Efeito | Unidades | Razão |
|---|---|---|---|
| Veneno Simples (Toxis 2) | 1/rod por 4 rodadas = 4 de dano | 1,16 | **1,16×** ✅ |
| Cura Rápida (Vitalis 2 + Regebolis 1) | cura 3 + 1/rod por 2 rodadas | 1,92 | **1,92×** ✅ |
| Corrosiva (Dissolvix 2) | −2 de Blindagem por 1 cena | 1,54 | **1,54×** ✅ |
| Entorpecente (Metanox 2) | Lento por 1 cena | 0,50 | **0,50×** 🔵 |

**Metanox 2 fica curta** e é estrutural, não calibragem: Lento vale 0,10 por
rodada e não sustenta uma dose sozinho, em nenhuma potência abaixo de 4. Duas
saídas, e a escolha é de sabor:

- **A** — Metanox passa a dar Lento **e** −1 no Alvo por 1 cena → 1,35× ✅
- **B** — a receita Entorpecente exige potência 4 (Lento + Atordoado) → 1,82× ✅

A **A** mantém a loção acessível no nível 1; a **B** a torna avançada. Recomendo
**A**: entorpecer é atrapalhar, e "−1 no Alvo" é o que atrapalhar significa em
regra.

### O que impede o alquimista de fazer só loção forte

**Graus de Sucesso = doses.** Como a Dificuldade é o redutor do teste, loção
difícil rende menos frascos:

| Dificuldade | Alvo de Macerar | Doses por tentativa |
|---|---|---|
| 2 | 7 | **2,1** |
| 4 | 5 | **1,0** |
| 6 | 3 | **0,3** |

*(Alquimista de referência: RAC 3 + Maceração 3 + Alquimancia 3 = Alvo 9.)*

O sistema se limita sozinho: **loção fácil é eficiente em volume, loção difícil
é eficiente em potência**, e acima de Dificuldade 6 não compensa fazer. Nenhum
teto artificial precisou ser escrito.

---

## 8. O que este documento NÃO decide

- ~~Nomes das reações~~ — **aprovados** (§4.3)
- ~~Roster de ingredientes~~ — **cadastrado**: 24 fontes no catálogo
  (`cadastrar-ingredientes-alquimia.mjs`), das 9 comuns de mercado às 2 de
  expedição, com as 8 receitas cozinháveis provadas por assert. Canal de
  Essência conta +1 na raridade.
- **Quem cunha os Luns e quem controla os veios** — [LACUNA] no Compêndio de
  Cristalomancia; decisão de mundo grande demais para esta frente
- **Poções** — virão depois, por decisão. Se poção é líquida, ela é a via de
  área que a loção não tem, e o §1 deste documento é o contraste
