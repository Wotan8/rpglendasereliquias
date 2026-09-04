# Prompt para o agente de condições — fase 2 (confluências e lacunas)

Você é o responsável por auditar, criar e balancear condições — você fez as 28
atuais (`system/data/conditions`), a paleta por Essência, a regra da Chance e
os capítulos 6–7 da Régua de Balanceamento. Sua branch é `condicoes`
(`CONDICOES.md`, `audit-condicoes.mjs`, `cadastrar-condicoes.mjs`). Esta é a
fase 2, encomendada pela frente de Runomancia: **toda runa ofensiva passou a
aplicar a condição da sua natureza**, e as confluências elementais criam
elementos que a paleta atual não cobre.

Regras que continuam valendo (suas): régua em `book-regua-balanceamento`
(1 unidade = 3,445), **não se cria condição de mesmo sentido** — mapear para
existente vem antes de criar — valor declarado na descrição de cada condição
(a régua de magias lê de lá), portão único (Chance OU resistência), e tudo
com dry-run + assert.

## Encomenda 1 — CONGELAMENTO (nova; design do dono do mundo, fechado)

Trilha de níveis, como a Exaustão:

- **níveis baixos** — o alvo fica **Lento**;
- **níveis médios** — a pele e a carne começam a petrificar: o alvo **perde
  Vitalidade se fizer qualquer ação ou movimento** (o movimento quebra pele e
  músculos superficiais);
- **níveis avançados** — **impede qualquer ação**; se o alvo resistir e agir
  mesmo assim, **pode se partir**: perda de membros ou a própria vida.

Cabe a você: quantos níveis, o valor de cada um na régua, como sobe e desce
(fonte de frio contínua? calor remove?), e o preço em Chance/potência para
habilidade que a aplica. Fontes que vão usá-la: confluência **Gelo**
(Água + Vento, Vento maior) e **Cristal de Gelo**; o **Cronogelo** (proibida)
provavelmente é Congelamento + algo de Tempo — sua chamada.

## Encomenda 2 — o par da 14ª Essência (Carmesim/Sangue)

A paleta declara 13 pares; **Sangue não tem nenhum**. Negativa candidata
óbvia: sangramento/hemorragia (dano contínuo que escala com movimento?
estanca com ação?). Positiva: sua proposta. Atenção ao aviso já registrado em
memória: *buff ao Sangral não precificado* — o par mexe diretamente na classe
mais física do elenco, então o valor precisa passar pela régua com cuidado
redobrado.

## Encomenda 3 — auditoria das 21 confluências

A Runomancia funde essências em elementos (tabela em
`laboratorium-runarum/js/compendium-data.js`, `RUNO_TABELAS.confluencias`).
Para cada um, decidir: **mapeia para condição existente** (preferência, pela
sua própria regra) **ou precisa de nova**. Meu palpite de partida — vocês
decidem:

| Confluência | Cobertura provável |
|---|---|
| Vapor · Névoa · Areia · Fumaça · Cinzas | Ofuscado (existe) |
| Lava · Plasma · Chama Eterna | Queimadura N (existe; Chama Eterna talvez seja "não se apaga", variante e não condição) |
| Lama | Lento / Imobilizado (existem) |
| **Gelo · Cristal de Gelo** | **Congelamento (encomenda 1)** |
| Gravidade | Ancorado / Prostrado (existem) |
| Vácuo | Afogando (existe) |
| **Raio** | Atordoado cobre? Ou merece própria (choque)? — sua chamada |
| Miasma | Definhado + Corrompido (existem) |
| Fogo Fátuo · Névoa Abissal · Luz Inversa | combinações de existentes? — sua chamada |
| Metal · Sal | provavelmente nenhuma (material, não aflição) |

## Entregável

1. Condições novas cadastradas em `system/data/conditions` com valor na
   descrição, no seu padrão;
2. Tabela confluência → condição (nova ou mapeada) num `.md` na sua branch —
   a frente de Runomancia vai ler dela para preencher o campo
   `condicoesAplicadas` das runas;
3. Atualização dos capítulos 6–7 da Régua com o que mudou;
4. Aviso na conversa da branch `with_vscode` quando terminar.

Contexto de consumo: além das runas, as loções da Alquimancia já aplicam
condições (capítulo "As Oito da Bancada" no Compêndio de Alquimancia), e o
canal Necrótico existe em ingredientes (Fungo-do-Véu, Flor-Cadáver). A demanda
por condições bem precificadas só cresce.
