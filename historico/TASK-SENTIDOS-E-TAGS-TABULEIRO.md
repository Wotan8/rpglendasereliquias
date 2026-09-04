# Task — Sentidos e visões especiais no Tabuleiro, por tag com potência

> **Isto é uma IDEIA, não uma especificação fechada.** É o jeito que eu imaginei
> para fazer diferentes tipos de sentido e visão funcionarem na prática no VTT.
> Se você tiver uma ideia melhor de aplicar isso, **fale antes de implementar**.
> O que não é negociável é o problema, não a solução: hoje uma magia de visão é
> texto na ficha e o Tabuleiro não sabe que ela existe.

---

## 1. O problema

O sistema tem magias e habilidades de sentido — visão noturna, ver o invisível,
tremorsense, visão verdadeira, e agora a **Visão Hemática** do Sangral, que em
31/08/2026 passou a enxergar *"o sistema circulatório inteiro de quem está à
vista, o sangue derramado ainda fresco no chão e as criaturas atrás de parede"*.

No Tabuleiro nada disso acontece. O jogador lê o efeito, o mestre descreve, e a
mesa finge. O que existe hoje é binário e fechado:

```js
// tabuleiro/js/tab-fog.js:27  — HARDCODED
export const SENSORES = [
    { id: 'padrao',       nome: '👁️ Padrão (precisa de luz)' },
    { id: 'noturna',      nome: '🌙 Visão noturna' },
    { id: 'verInvisivel', nome: '✨ Ver o invisível' },
    { id: 'tremorsense',  nome: '🌊 Tremorsense (ignora paredes, mesma elevação)' },
    { id: 'verdadeira',   nome: '🔮 Visão verdadeira' },
];
```

Cinco sensores fixos no código, e `tokenVisivelParaMim()` decide por `if` de id.
Isso viola a regra do projeto: **NUNCA hardcodear regra de jogo — toda régua vem
do cadastro em nuvem; se falta campo, cria o campo e migra o dado.** Cadastrar
uma sexta visão hoje exige mexer em JS e publicar.

---

## 2. A ideia

**Objetos do Tabuleiro carregam tags com potência e cor. Uma skill de sentido
declara quais tags ela enxerga. Quando o token ativa a skill, os objetos com
aquelas tags brilham — na cor da tag e na intensidade da potência.**

Três peças:

### 2.1 Tag com potência

A tag deixa de ser só um rótulo de texto e passa a ter:

| campo | o que é |
|---|---|
| `nome` | "Essência de Vida", "Essência de Sangue", "Metálico", "Arcano" |
| `cor` | a cor do brilho quando revelado |
| `potencia` | quanto brilha — 0 a N, escala a definir |

Já existe um campo `tags` (type `tags`) em `shared/equip-campos.js:40`, hoje só
texto livre. A questão de design: **estender a tag existente** ou criar um
cadastro separado de tags com as tags de texto virando referência a ele. Prefiro
o segundo (uma coleção `tags` no `system/data`), mas avalie — há uso de tags
espalhado em `tab-golpes.js`, `tab-mostrar.js`, `tab-ficha-win.js`.

### 2.2 Tags padrão por tipo de objeto

Token de personagem ou NPC **orgânico** já nasce com `Essência de Vida` e
`Essência de Sangue`, sem ninguém marcar nada. Se todo Sangral tiver que taguear
cada NPC à mão antes da sessão, a funcionalidade morre no primeiro uso.

Onde estão os tipos de objeto: `tab-objects.js:554` (`iconeTipo`) — imagem,
token, texto, desenho, medida, alfinete, luz, porta, janela, mostrar, template,
terreno, relogio, loot.

Um construto ou morto-vivo não tem Essência de Vida. Um esqueleto não tem sangue.
Isso precisa vir do cadastro do NPC (a criatura já declara Essências), não de um
`if` por tipo de token. **Não invente qual criatura tem qual essência — puxe do
cadastro, e onde o dado não existir, pergunte.**

### 2.3 A skill de sentido

Quando um token ativa a skill, o Tabuleiro passa a desenhar os objetos com as
tags que ela enxerga, mesmo através de parede, com brilho = cor da tag e
intensidade = potência.

---

## 3. O que a skill precisa ter no cadastro

Proposta de campos. Todos no cadastro, nenhum no código:

| campo | tipo | o que faz |
|---|---|---|
| `sentido.tagsQueVe` | lista de tags | quais tags a skill revela. Vazio = nenhuma |
| `sentido.alcanceM` | número | raio em metros. Vazio = a cena inteira |
| `sentido.atravessaParede` | booleano | ignora oclusão para as tags declaradas |
| `sentido.exigeLuz` | booleano | como o sensor `padrao` de hoje |
| `sentido.potenciaMinima` | número | só revela tag com potência ≥ este valor — é o que faz "visão fraca vê pouco" |
| `sentido.duracao` | já existe | a skill já declara duração; reaproveitar |

Convenções do projeto que valem aqui:

- Toda habilidade custa **1 Ação Padrão** por padrão — não escreva "sem gastar
  ação". Sustentar não custa ação; o recurso da conjuração já pagou a duração.
- Alcance em metros segue o padrão `alcanceM` que as armas já usam.
- O nível do Domínio da escola é o gate da magia; o redutor por Qualidade acima
  do Domínio **soma** com o Redutor próprio (decisão de 31/08/2026).

`sentido.potenciaMinima` é o gancho para a régua: uma visão de tier baixo enxerga
só o que brilha forte; a de tier alto enxerga o rastro fraco. Isso dá ao
balanceamento um parafuso que não é "vê ou não vê".

### 3.1 Potência que decai

A regra da Visão Hemática (31/08/2026) é **sangue fresco aparece, sangue seco ou
morto não**. Isso quer dizer que a potência de uma tag não é sempre fixa: a poça
recém-derramada brilha, a mancha velha some.

O modelo precisa suportar tag cuja potência cai com o tempo de jogo — e a skill
que enxerga só o que está acima de `potenciaMinima` faz o resto sozinha, sem
regra nova. Uma visão mais forte lê rastro mais velho.

Não invente a curva de decaimento nem o tempo de secagem; isso é decisão de
mesa. O que a implementação precisa é **suportar** potência variável, e o número
vem do cadastro.

---

## 4. Como o Tabuleiro processa

O caminho já existe, só está fechado. Os pontos de entrada:

| arquivo | o que muda |
|---|---|
| `tabuleiro/js/tab-fog.js:27` | `SENSORES` sai do código e vem do cadastro. Os 5 atuais viram registros migrados, não um `if` |
| `tab-fog.js` `tokenVisivelParaMim()` | hoje decide por `hit.sensor === 'verInvisivel'`. Passa a perguntar: as tags deste objeto batem com as tags que meu sentido ativo enxerga? |
| `tab-fog.js` `pontoVisivelAgora()` | `atravessaParede` já tem precedente no `tremorsense` ("ignora paredes, mesma elevação") — reutilize a mecânica, não escreva outra |
| `tab-render.js` | o brilho: cor da tag, intensidade pela potência. É aqui que mora o custo de quadro |
| `tab-objects.js` | tags na criação e nas propriedades do objeto |
| `tab-turno.js` | ativar a skill liga o sentido no token pela duração declarada |

**Desempenho é requisito de pronto, não otimização depois.** O próprio
`tokenVisivelParaMim` já carrega um aviso no comentário: roda por token a cada
quadro e testa ponto-em-polígono contra visões de centenas de vértices, com 3
telas pagando o custo. Somar uma varredura de tags por objeto por quadro em cima
disso é a receita para travar a mesa cheia.

- Ligue o HUD por etapa com `?perf=1` e meça antes e depois.
- `__check-perf-arrasto.html` reproduz a carga de uma mesa cheia.
- Cachear por `PERF.fogKey` (só muda quando visão ou parede muda) já está sugerido
  no código como a saída certa.
- Leia a skill `desempenho-tabuleiro` antes de começar.

---

## 5. Ordem sugerida

1. **Decidir o modelo da tag** — estender o campo existente ou coleção nova. Traga
   a recomendação antes de codar; há uso de `tags` espalhado.
2. Cadastro de tags com cor e potência, e as tags padrão por tipo de objeto.
3. Migrar os 5 sensores hardcoded para o cadastro, **sem mudar comportamento**.
   Este passo é puramente de refatoração e dá para verificar que nada quebrou.
4. Campos de `sentido` no cadastro de skill.
5. O Tabuleiro lendo isso: visibilidade primeiro, brilho depois.
6. Medir com `?perf=1`, comparar com a linha de base.

Passos 3 e 5 são os que podem quebrar mesa em andamento. Vale um teste antes.

---

## 6. Casos concretos para validar

| skill | o que tem que acontecer |
|---|---|
| **Visão Hemática** (Sangral, Círculo Mestre) | vê tokens com Essência de Sangue através de parede, e sangue derramado **enquanto fresco** |
| poça de sangue velha | **não** aparece — a potência da tag já decaiu (§3.1) |
| **Visão noturna** | o que já faz hoje, sem regressão |
| **Ver o invisível** | idem |
| **Tremorsense** | idem — e é o precedente de `atravessaParede` |
| construto / morto-vivo | **não** aparece na Visão Hemática: sem Essência de Sangue |

---

## 7. Regras da casa

- Nada de regra de jogo em código. Faltou campo, cria o campo e migra o dado.
- Não invente lore nem número. Campo narrativo vazio é pergunta, não convite.
- Script em `functions/`: dry-run por padrão, `--apply` para gravar, backup em
  JSON antes de tocar em dado de mesa, âncora que aborta se o estado não for o
  esperado.
- Responsivo sempre: nasce funcionando no celular.
- O grafo do projeto está em `graphify-out/` — consulte antes de reler arquivo por
  arquivo. `graphify affected "tokenVisivelParaMim()"` mostra quem quebra.
