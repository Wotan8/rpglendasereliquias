---
name: padrao-peculiaridades-avulsas
description: "Como cadastrar peculiaridades individuais (avulsas) da criação, com níveis e EXP correta por nível"
metadata: 
  node_type: memory
  type: project
  originSessionId: b84f74d3-53ae-4c6b-9e85-e867d96f7e1e
  modified: 2026-07-28T13:43:05.684Z
---

As **Peculiaridades Avulsas** (traços individuais, escolhidos na criação) vêm do PDF
`D:\Imagem\US - Universo Soberano\RPG\Reliera\0- Mestre\Sessão 0\Peculiaridades_Avulsas.pdf`.
30 delas foram cadastradas em 27/07/2026, substituindo os placeholders "Magro" e "Gordo".

**Estrutura de cada avulsa** (`system/data/peculiarities`):
- `fonte: "individual"` + `quandoSeAplica: "na_criacao"` + tags `["Criação","Avulsa"]`
  — é esse filtro exato que faz aparecer no wizard (`INDIVIDUAL_PECULIARITIES`).
- `ehVantagem: true` → custa EXP; `false` → concede EXP.
- **Nível 1**: EXP via `mecanicaExpCriacao` (mecânica `modificar` com `alvo: "EXP"`,
  `qualExp: "ambos"`, `quandoAplica: "na_criacao"`). Há 7 compartilhadas:
  `Custo Avulsa -2/-4/-5/-8 EXP` e `Ganho Avulsa +2/+4/+5 EXP`.
- **Níveis 2+**: uma mecânica `tipo: "narrativo"`, `evoluivel: true`, `nivelMaximo: N`,
  `progressao: {1:{custoExp:0,descricao},2:{custoExp:X,descricao},...}` vinculada em
  `mecanicaIds`. O `custoExp` de cada nível é **incremental**, não acumulado.
- `progressaoApenasCriacao: true` nas que o livro marca "Somente na Criação"
  (gera badge 🏗️ e trava evolução depois).

**Regra do efeito situacional vs. mecânico** (revisão de 28/07/2026): efeito descrito
como *situacional* fica só como texto na `progressao` do narrativo; **todo efeito
numérico NÃO situacional precisa de uma mecânica `modificar` de verdade**.

- **Uma mecânica por alvo.** `progressao.termos` reindexa o `fixoIdx` a cada
  `calculo`, então uma mecânica com 3 cálculos daria o mesmo valor aos três. O padrão
  da casa é `"<PEC> — <Alvo>"`, um doc por alvo (ver `PÉS INVERTIDOS - Briga/Esquiva`).
- **O `custoExp` vai em UMA só mecânica** (a narrativa "(Níveis)"); as `modificar`
  levam `custoExp: 0`. `_resolvePeculiaridade` **soma** o `custoExp` de todas as
  evoluíveis da peculiaridade.
- Todas as evoluíveis de uma mesma peculiaridade devem ter o **mesmo**
  `progressaoTipoExp` — `isGanhoExp` usa `.some()`, então uma 'ganho' solta inverte
  o sinal do card inteiro.
- Alvo = **nome legível** do Valor Derivado (`"Altura"`, `"Desloc. Terrestre"`) ou
  `"Perícia: <nome>"` para perícia.
- Se o VD tem `todoPersonagem: false` (ex. `Percepção Olfativa`), a mecânica sozinha
  **não** faz o campo aparecer: é preciso também pôr o VD no `derivedValueIds` da
  peculiaridade (`{id, valorInicial:0, characterCreationMin:0, characterCreationMax:0}`).
  Ter a peculiaridade então vincula o VD ao personagem automaticamente — pelas quatro
  fontes (raça, classe, tribo, individual), na ficha (`renderDerivedValuesGrid`), na
  Véspera da Partida (`finale-module.js`) e no `simulateDerivedValues`. Regressão em
  `ficha-v1.7_1/js/derived-values-visibility.test.mjs`. Os `characterCreationMin/Max`
  da entrada mandam no slider da Véspera; `0/0` deixa o campo só-leitura.

Ver [[cascata-de-altura-nos-derivados]] antes de criar mecânica de Peso, Tamanho,
Vitalidade, Carga ou Deslocamento — várias já se movem sozinhas.
Ver [[limitacao-dano-nao-estruturado]] para o caso do dano, que continua sendo texto.

**Ajuste de código necessário** (feito): `criar-personagem/js/peculiarities-module.js`
→ `setPecLevel()` calculava EXP linear (`valor × nível`), o que quebrava as
não-lineares (Sortudo 8/20/50, Voz Marcante 4/12/24). Agora soma a EXP exata de
`pec.niveis[i].custoExp` respeitando `tipoExp` ('ganho'/'custo'), com fallback linear
quando a peculiaridade não tem `niveis`. A **ficha não precisou mudar** — o
`_resolvePeculiaridade` em `ficha-v1.7_1/js/system-data-loader.js` já monta `niveis`
a partir da `progressao` das mecânicas evoluíveis (mesmo caminho das peculiaridades
de raça/classe/tribo).

**Cuidado ao remover peculiaridades:** conferir se a mecânica de EXP é compartilhada
antes de deletar. A do "Magro" (`3v2g2mNRpgP5YKRjVOut`) também é usada por
"Aura de Força 1" — foi mantida; só a órfã do "Gordo" foi apagada.

**Estado em 28/07/2026: 28 avulsas.** "Alto" foi fundida em **Gigantismo** e "Baixo"
em **Nanismo** (3 níveis, ±10% de Altura por nível, EXP 5/10/15, só na criação);
os docs "Alto" e "Baixo" e suas mecânicas foram apagados. Ganharam mecânica de
cálculo: Gigantismo, Nanismo, Corpulento, Franzino, Glutão, Manco, Caolho,
Veterano de Guerra, Medroso, Cicatriz Notável, Olfato Apurado. Continuam 100%
textuais (tudo situacional): Albino, Vegetariano, Azarado, Sortudo, Alérgico,
Resistente à Dor, Desajeitado, Dupla-Face, Memória Prodigiosa, Roncador, Sono Leve,
Hipermóvel, Voz Marcante, Feio, Gago, Teimoso, Bonito.

O "Olfato Apurado" mostra a armadilha do rótulo: o PDF escrevia "+1 **situacional**
em Percepção olfativa", mas `Percepção Olfativa` é um Valor Derivado de verdade —
o rótulo estava errado. Escala +1/+2/+3, metade da racial `OLFATO EXCEPCIONAL +VD`
dos Tamano (+2/+3/+4), que é uma raça construída em volta do faro. Ao revisar as
outras, desconfiar de "situacional" sempre que o alvo citado for um VD cadastrado.
