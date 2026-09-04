# Runimago — a camada de classe sobre a Runomancia

A frente NÃO mexe no sistema-mãe. O Compêndio (15 capítulos públicos), os 64
`runicElements` e a engine do Laboratorium são a fonte de verdade — auditados e
completos. O que não existe é a **ponte para a mesa**: o Runimago tem 0 módulos,
e uma runa projetada no Laboratorium não tem como entrar num combate.

---

## 0. O que a varredura encontrou

| Peça | Estado |
|---|---|
| `runicElements` | **64**: 5 Artus · 14 Aspectus (todas as Essências, Sangue incluso) · 45 Sigilus |
| Compêndio de Runomancia | 15 capítulos públicos, com contabilidade fechada (CT = Artus + Aspectus + Σ Sigilus) |
| Laboratorium | designer de circuito + engine de auditoria pura + exportador de ficha técnica |
| Economia | Luni = moeda E célula (25 Ess) · Linhas de Ley · lei criminal por confluência |
| Classe Runimago | **zero módulos, zero itens** — é só isto que falta |

Os "Sigilos" que travavam a frente **existem**: são os 45 Sigilus, em sete
funções canônicas (captação, armazenamento, lógica, condução, modulação,
emissão, exaustão).

---

## 1. A âncora que já estava no cânone

> §2.2: *"Corpo do Runomago: **5 Ess por pulso (1 Energia)**."*

Com 1 Energia = 1,00 unidade (Régua §4.1):

```
1 Ess  = 0,20 unidade
1 Luni = 25 Ess = 5,00 unidades  (por 1 L$!)
```

**Consequência honesta, declarada:** a Essência de cristal é a energia mais
barata do sistema — 1 L$ compra o que o alquimista vende por ~120. É o ponto:
Runomancia é *tecnologia*, e tecnologia barateia a energia. O equilíbrio não
está no custo por ativação; está no **capex**:

| Custo real da runa | Fonte (cânone §6.4) |
|---|---|
| Material | 2 L$ × CT (×2 avançado, ×3 mestre) |
| Tempo | CT ÷ 5 horas |
| Teste de Construção | com falha catastrófica possível |
| Porte | Sifão com teto de absorção; runa é objeto que se carrega, perde e quebra |

Uma runa de combate típica (CT 20) custa ~40 L$ + 4 horas + um teste — e cada
disparo custa 1 Luni. **Capex caro, opex barato: é uma arma de fogo com pólvora
de um centavo.** A loção é o inverso. Os dois modelos convivem porque cobram em
moedas diferentes.

---

## 2. As três formas de uma runa entrar em jogo

### 2.1 Runa Gravada (a padrão)

Objeto com o circuito gravado, carga própria, lógica própria. Em combate:

- **ativar custa 1 Ação Padrão** (§0.5 — como tudo), que é *tocar/acionar*
- runa com Gatilho/Sensor **dispara sozinha** quando a condição lida acontece —
  armadilha não gasta ação de ninguém
- o dano/efeito segue a régua de dado por barreira: parcela de Essência em
  d4 por nível equivalente, **confluência física** (Lava, Metal, Vapor…) fere
  no canal físico — d6/d8. *É por isso que o cânone chama as físicas de
  "permitidas a qualquer aprendiz": são as balas baratas.*

### 2.2 Runa Emprestada — "qualquer um pode usar"

**DECIDIDO** — a regra é a lógica do próprio circuito, sem cerimônia de
ensino:

> Qualquer pessoa ativa uma runa de **gatilho simples** (Toque, Gatilho,
> alavanca, pressão) com 1 Ação Padrão. O circuito faz o resto.
> Runa com **lógica de acesso** obedece à lógica: Reconhecedor Biométrico só
> responde à biometria cadastrada, Selector só a quem foi selecionado,
> Contador para quando a contagem acaba.

O controle de quem usa **é projeto, não regra**: o Runimago que não quer
emprestar não tranca a runa no baú — grava um Reconhecedor. A paranoia dele é
jogável com Sigilus que já existem.

### 2.3 Mentalização — NÃO EXISTE

**DECIDIDO pelo dono do mundo:** conjurar runa "de cabeça" contradiz a
identidade do sistema — Runomancia é extremamente lógica e programável, e um
circuito imaginado não tem credibilidade de circuito. Não há atalho: runa
existe gravada ou não existe.

⚠ O `papelEmCena` da classe dizia *"mentaliza runas de combate (requer perícia
3+)"* — corrigido no banco pelo script desta frente. O improviso do Runimago é
outro: **é ter trazido a runa certa** — ou gravar uma às pressas com a
Escripta (§6), que é rápida, barata e gasta.

---

## 3. O módulo de classe: "Cartucho Rúnico"

Um módulo só, tipo lista, **`permitirCriacaoJogador: true`** — o primeiro da
casa onde isso é o ponto. Cada item é UMA runa que o jogador projetou:

| Campo | Origem |
|---|---|
| Nome | jogador |
| CT | auditoria do Laboratorium |
| Alvo de Construção | idem |
| Efeito (texto) | ficha técnica |
| Forma (gravada / emprestável) e ramo (Escripta/Talha/Tatuagem) | flags do circuito |
| Cargas restantes | contador |
| `alcance/formaArea/duracao...` | campos tipados do passo 7, como toda magia |

O Laboratorium já exporta ficha técnica (SVG + auditoria) — o passo natural é
um botão **"enviar para a ficha"** que cria o item do módulo com os números da
auditoria. Zero digitação, zero divergência entre o projeto e a mesa.

**Portões pela perícia** (mesmo desenho dos ritos): confluência arcana exige
Runomancia 2+ (cânone §4.5) · Proibidas são crime, não portão — o limite delas
é a forca, e isso é roleplay.

---

## 4. Por que isso é divertido (o teste da mesa)

O Invocador aposta; o Runimago **prepara**. A diversão dele é a do engenheiro:

1. **A preparação paga.** A armadilha que ele passou a tarde gravando dispara
   no momento exato — Gatilho + Sensor fazem a mesa inteira olhar para ele.
2. **O grupo carrega as runas dele.** Emprestar é a mecânica social da classe:
   o guerreiro leva a lâmina com runa de Metal, o batedor leva a pedra de luz.
   O Runimago está em quatro lugares ao mesmo tempo.
3. **O improviso existe e custa** — a Escripta grava às pressas uma runa de
   poucos usos, então a pergunta "eu trouxe a runa certa?" tem drama de
   verdade: a resposta errada custa tinta, tempo e o momento.
4. **O risco é técnico, não caótico**: subcarga, sobrecarga, Rastro. Quando dá
   errado, deu errado porque ELE errou o projeto — e a tabela diz exatamente
   como. Previsível até na falha, como o dono do mundo pediu.

---

## 5. Runa sempre aplica condição — DECIDIDO

Dano rúnico segue a régua de dado por barreira **e toda runa ofensiva carrega a
condição da sua natureza**, com portão de Chance ou resistência como qualquer
habilidade (Régua cap. 6). O mapa usa a paleta por Essência já cadastrada:

| Aspectus / Confluência | Condição |
|---|---|
| Fogo | Queimadura |
| Terra · Natureza | Imobilizado |
| Vento · Espacial | Desorientado |
| Água | Afogando (submersão) |
| Necrótico | Definhado |
| Luz | Ofuscado / Cego |
| Sangue | — [ver paleta Carmesim] |
| **Gelo** (Água + Vento, Vento maior) | **Congelamento** (criado — trilha de 3 níveis) |
| Lava / Metal (Fogo + Terra) | Queimadura agravada [A CRIAR?] |
| Miasma (Vento + Necrótico, proibida) | Definhado + Corrompido |

**Lacuna fechada pela fase 2:** Congelamento existe (trilha Enregelado →
Cristalizado → Rompente), Hemorragia e Pacto de Sangue dão o par da 14ª, e as
21 confluências estão mapeadas em `CONFLUENCIAS-CONDICOES.md` (branch
`condicoes`) — 12 condições cobrem tudo. A tabela acima fica como resumo; a
fonte é o mapa de lá.

---

## 6. Os três ramos — Escripta, Talhador, Tatuador

**DECIDIDO: a Runomancia tem três ofícios de gravação**, separados por perícia
e por Peculiaridade de Domínio (o padrão de 12 EXP das armas e focos):

| | **Escripta** | **Talhador** | **Tatuador** |
|---|---|---|---|
| Ferramenta | pincel e tinta | talhadeiras | agulhas rituais |
| Superfície | papel, tecido, pele de tambor, parede | pedra, metal, madeira, osso | **carne viva** |
| Tempo (× o padrão CT ÷ 5 h) | **0,75×** | **4×** | **1,25×** |
| Material | ≈ 1 L$ × CT (metade) | ≈ 2 L$ × CT (o padrão) | ≈ 3 L$ × CT + Infusor |
| **Usos** | **muito limitados** (fórmula abaixo) | **muitos usos** (fórmula abaixo) | **permanente no portador** — some se escalpelarem a pele ou o membro for perdido |
| Perícia | `Escripta Rúnica` | `Talha Rúnica` | `Tatuagem Rúnica` |
| Domínio (Pec 12 EXP) | Domínio de Escripta | Domínio de Talha | Domínio de Tatuagem |
| Risco próprio | borrar (falha desperdiça material, não explode) | falha estrutural clássica | Lei da Afinidade (§4.4) — a carne reage |

*(Tempos DECIDIDOS pelo dono do mundo: a tinta corre pouco mais rápido que o
padrão; a talha é 4× mais lenta — é o ofício da paciência e da permanência; a
agulha paga 1,25× pelo cuidado com a carne.)*

**Fórmula de usos — Escripta (APROVADA):**

```
usos = Perícia: Escripta Rúnica + qualidade do material − ⌈CT ÷ 20⌉   (mínimo 1)

qualidade: tinta comum 0 · tinta fina +1 · tinta-mestra +2
```

Escripta Rúnica 3 com tinta fina numa runa CT 20: 3 + 1 − 1 = **3 usos**.

**Fórmula de usos — Talhador [A APROVAR]:** a mesma conta, **× 10**:

```
usos = 10 × (Perícia: Talha Rúnica + qualidade do material − ⌈CT ÷ 20⌉)   (mínimo 10)
```

Talha 3 em pedra boa, CT 20: **30 usos**. "Muitos" sem ser infinito: a runa
estrutural envelhece, e re-entalhar é serviço que o Talhador cobra.

**Sem o Domínio do ramo**, grava-se só rascunho: usos travados em 1 e −2 no
Teste de Construção. Com ele, o ofício inteiro. `Gravação Rúnica` (que já
existe, DES/INT) permanece como a teoria comum: continua dando −10% de tempo
por nível, em qualquer ramo.

**Tatuador é o ramo com física própria:** superfície viva exige Infusor (cânone
§6.4), o Rastro anda com a pessoa, e a Lei da Afinidade governa a relação
tinta-carne. Runa tatuada não se perde nem se rouba — se paga com o corpo.

---

## 7. Laboratorium — Materiais e Exaustão de verdade [A IMPLEMENTAR]

Especificação da melhoria pedida (front, entrega à parte):

### 7.1 Painel "Bancada" (novo, fora do bloco de auditoria)

- lê o **inventário equipado do personagem logado** e identifica o que serve à
  gravação: pincéis, tintas, talhadeiras, agulhas, papéis, Lunis;
- container equipado aparece como container: clicar abre **só os itens de
  runomancia** de dentro;
- o Runomago **seleciona instrumento e quantidades** — pincel X, tinta Y,
  2 folhas, 3 Lunis;
- o Auditor troca o "💰 Material ≈ X L$" genérico por **a lista exata do que a
  runa consome — e o que está faltando**, em vermelho, como violação.

### 7.1b Comportamento dos materiais — DECIDIDO criar as classes

Todo item de bancada declara como se gasta (campo tipado no catálogo,
`comportamentoMaterial`):

| Classe | Comportamento | Exemplos |
|---|---|---|
| **Consumido** | some no uso, quantidade desconta | tinta, papel, Lunis, agulhas descartáveis |
| **Desgastável** | contador de desgaste; a cada uso, `chance de estragar = desgaste ÷ 10` (1d10) | pincéis, talhadeiras finas, brocas |
| **Resistente** | não gasta em uso normal; só quebra por falha crítica de gravação | talhadeiras pesadas, bancada, pilão rúnico |

A Bancada do Laboratorium lê a classe do item: consome quantidade dos
Consumidos, incrementa e rola o desgaste dos Desgastáveis, e alerta quando um
Desgastável passa de 7 (70% de chance de estragar no próximo uso — trocar a
ferramenta é mais barato que perder a gravação). Falha no Teste de Construção
com Desgastável em campo: o desgaste sobe +2 em vez de +1.

### 7.2 Exaustão com contabilidade real

O card "♨️ Exaustão" passa a fechar o balanço com os Lunis selecionados:

```
Ess selecionada (Lunis × eficiência do Sifão) → teto do captador
   − CT da ativação
   − capacidade de armazenamento
   = excedente → Exaustor
```

Excedente acima do Exaustor → alerta de **Sobrecarga** nos campos de risco;
Ess abaixo do CT → alerta de **Subcarga** (a tabela §2.8 já existe na engine).
O projetista vê o erro **antes** de gravar — que é o espírito da classe.

---

## 8. Decisões restantes

1. **Fórmula de usos da Escripta** (§6) — aprova?
2. **Tempos/custos dos três ramos** (÷4 · padrão · ×2) — aprova?
3. **Congelamento e as condições de confluência** — abrir na frente de
   condições, ou aceitar o mapeamento provisório (Gelo → Lento)?

---

## 9. Fase 2 das condições — recebida (adendo)

A frente de condições entregou: **31 condições**, com Congelamento (trilha de
3 níveis: Enregelado → Cristalizado → Rompente), Hemorragia N e Pacto de
Sangue (o par da 14ª). As 21 confluências mapeadas em
`CONFLUENCIAS-CONDICOES.md` (branch `condicoes`) — **12 condições cobrem
tudo, uma nova só**. O campo `condicoesAplicadas` das runas preenche a partir
de lá.

Princípio novo que afeta projeto de runa (§6.13): **imposto sobre ação nunca
vale mais que 1,000** — o alvo sempre pode parar de agir. Runa que cobra
Vitalidade por ação do alvo é mais barata do que a conta linear sugere.

Cadastrado no banco por `cadastrar-ramos-runomancia.mjs`: as 3 perícias de
ramo, os 3 Domínios (12 EXP) e o módulo **Cartucho Rúnico**
(`permitirCriacaoJogador: true`, 9 campos) — vinculado à classe, que saiu de
zero módulos.
