# Varredura de segurança — 31/08/2026

Leitura adversarial do que um jogador registrado (ou um visitante qualquer)
consegue fazer com DevTools aberto. Alvo pedido: **Repertório** e **pagamentos**.
Nada foi explorado contra o ambiente real — todas as cadeias abaixo foram
derivadas do código e das rules.

Nenhum arquivo de produção foi alterado, exceto uma linha em `firebase.json`
(item **12**) para que este relatório e os outros `.md` internos parem de ser
servidos publicamente.

Legenda de esforço: **P** = pequeno (uma linha / uma regra), **M** = médio
(mexe em função e exige migração de dado), **G** = grande (frente própria).

---

## Resumo por risco

| # | Falha | Risco | Esforço |
|---|---|---|---|
| 1 | Qualquer visitante vira **mestre/criador** | 🔴 Crítico | P ✅ |
| 2 | Sequestro de identidade pelo campo `uid`/`email` — rouba compra paga | 🔴 Crítico | M ✅ |
| 3 | Forja de item no Repertório pela Caixa do Mestre (EXP infinito) | 🔴 Crítico | M ✅ |
| 4 | Webhook do Mercado Pago sem assinatura, sem conferência de valor e sem estorno | 🟠 Alto | M ✅ |
| 5 | `npcs` e `items` de NPC graváveis por qualquer autenticado | 🟠 Alto | P ✅ |
| 6 | Coleção `users` legível inteira por qualquer autenticado | 🟠 Alto | M ✅ |
| 7 | reCAPTCHA falha aberto + zero rate limit / App Check nas callables | 🟠 Alto | M ✅ parcial |
| 8 | Storage: qualquer autenticado sobrescreve hero, favicon e imagem de item | 🟡 Médio | P ✅ |
| 9 | `escapeHtml()` não escapa aspas → XSS em atributo | 🟡 Médio | P ✅ |
| 10 | Sem verificação de e-mail no cadastro | 🟡 Médio | P ✅ |
| 11 | Empilhamento do Repertório por `nome` | 🟡 Médio | M ✅ |
| 12 | Documentos internos servidos em produção | 🟡 Médio | P ✅ |
| 13 | `logs` com create aberto | 🟢 Baixo | P ✅ |
| 14 | `inventario`/`apoios` sem teto de tamanho | 🟢 Baixo | M ✅ |

---

## 🔴 1. Qualquer visitante vira mestre ou criador ✅ corrigido

**Onde:** [firestore.rules:33](firestore.rules:33) e [menu-firebase.js:1916](menu/js/menu-firebase.js:1916)

`naoMexeuEmCamposProtegidos()` protege `fragmentos`, `inventario`, `apoios`,
`logsCompra`, `fragLastOp`, `giros` e `rerolagens`. **`role` não está na lista** —
nem na regra de `create`, nem na de `update`. E `role` é exatamente o que decide
tudo:

- `isCriador()` nas rules → escrita total em `system/data/*` (o catálogo inteiro
  de regras do jogo), `app-config` e `portal-config`;
- `temPapelMestre()` nas rules → criar equipamento;
- [painel-mestre/js/auth.js:56](painel-mestre/js/auth.js:56) e
  [painel-criador/js/painel-firebase.js:815](painel-criador/js/painel-firebase.js:815) →
  abrem os painéis inteiros olhando só o `role`;
- [functions/index.js:702](functions/index.js:702) (`exigirMestrePorQualquerCaminho`)
  → aceita `role` como prova de que a pessoa é mestre.

Dois caminhos, ambos de uma linha no console:

```js
// já logado como jogador
updateDoc(doc(db,'users',auth.currentUser.uid), { role:'criador' })
```

E no cadastro nem isso é preciso: `MASTER_SECRET_CODE = "MESTRE5253"` está
literal no bundle público, e o formulário grava `role:'mestre'` direto
([menu-firebase.js:2024](menu/js/menu-firebase.js:2024)). O código secreto é
teatro de frontend — **as rules nunca o verificam**.

**Impacto:** apagar ou reescrever o catálogo de regras inteiro, trocar o hero e
o favicon do Portal, ler os avisos do mestre, e — combinado com o item 3 —
fabricar EXP comprado com dinheiro sem passar por ninguém.

**Feito em 31/08/2026:**

1. `role` entrou em `CAMPOS_PROTEGIDOS()` nas rules — bloqueado no `create` e no
   `update`. O navegador não escreve cargo em lugar nenhum, nem no próprio doc.
2. `MASTER_SECRET_CODE` apagado. O cadastro agora tem três opções (Jogador,
   Mestre, Criador) e as duas últimas são **pedido**: gravam
   `cargoSolicitado` — campo livre, que não vale nada sozinho — e a conta nasce
   Jogador, com o aviso disso na própria tela.
3. Cargo só muda por `definirCargo` (Cloud Function, Admin SDK), que exige
   Criador, recusa mexer no próprio cargo, recusa rebaixar outro Criador e grava
   trilha imutável em `cargo_logs`. A regra da decisão é pura em
   [functions/cargo.js](functions/cargo.js), com teste em `cargo.test.mjs`.
4. Fila de aprovação em **Painel do Criador → ⚙️ Configurações → 🔐 Permissões**,
   com bolinha no ⚙️ e na aba quando há pedido esperando. Aprovar concede o
   cargo pedido; recusar só apaga o pedido (não rebaixa ninguém). Os dois lados
   notificam a pessoa.

**Ainda por fazer:** `role` como *custom claim* do Firebase Auth, para as rules
lerem `request.auth.token.role`. Sumiria o `get()` por escrita e o papel
deixaria de morar num documento. Não é urgente agora que o campo é protegido.

⚠️ **Depende de deploy:** `firebase deploy --only firestore:rules,functions` —
até as rules subirem, o campo `role` continua gravável pelo navegador.

---

## 🔴 2. Sequestro de identidade pelo campo `uid` / `email` ✅ corrigido

**Onde:** [functions/index.js:137](functions/index.js:137) (`resolveUserRef`) e
[menu-firebase.js:1321](menu/js/menu-firebase.js:1321) (`findUserDoc`)

Os dois acham o documento do jogador **por consulta de campo**, não pelo ID:

```
1) where('uid','==',uid)  →  2) where('email','==',email)  →  3) doc(uid)
```

O cadastro grava `{ email, displayName, role, createdAt }` — **sem campo `uid`**.
Ou seja: hoje quase todo mundo cai no método 2 ou 3. E `uid` e `email` são campos
comuns do próprio documento, que o dono pode escrever (não estão protegidos).

```js
updateDoc(doc(db,'users',meuUid), { uid: '<uid da vítima>' })
```

A partir daí, **toda** callable que a vítima chamar resolve para o documento do
atacante: `comprarComFragmentos` debita o saldo do atacante e entrega no
Repertório dele; `aplicarExpDoItem` consome o inventário errado; e o pior —
`entregarCompra` no webhook chama `resolveUserRef(pending.uid)`, então **a compra
em dinheiro real da vítima é entregue ao atacante**.

A coleção `users` é legível por qualquer autenticado (item 6), então escolher a
vítima é uma listagem.

**Feito em 31/08/2026:**

A migração que se temia **não existia**: os 18 documentos de `users` já têm ID =
uid do Auth, e nenhum tem o campo `uid`. A cascata era herança morta — só o
buraco tinha sobrevivido.

1. A busca por campo saiu dos **sete** lugares onde estava copiada:
   [functions/index.js](functions/index.js:152) (`resolveUserRef`),
   [menu](menu/js/menu-firebase.js:1321), [painel-mestre](painel-mestre/js/auth.js:10),
   [painel-criador](painel-criador/js/painel-firebase.js:832),
   [ficha](ficha-v1.7_1/js/firebase.js:50), [tabuleiro](tabuleiro/js/tab-dados.js:48)
   e [worldbuilding](worldbuilding/js/wb-core.js:59). Todos agora leem
   `users/{uid}` e nada mais.
2. Nas rules, `uid` e `email` viraram identidade: no `create` só podem repetir o
   que está no token (`identidadeCorreta`). No `update`, `uid` nunca muda; o
   `email` só pode ser gravado com o valor do **próprio token** — o que libera
   a troca de e-mail nas Configurações (o documento acompanha o Auth no login
   seguinte) sem reabrir o buraco: apontar o próprio documento para o endereço
   de outra pessoa continua impossível, e há teste para os dois lados.
3. O Portal cria o documento se ele não existir — conta feita fora do cadastro
   não fica sem doc agora que não há mais fallback.

**Provado, não deduzido.** [firestore.rules.test.mjs](firestore.rules.test.mjs)
roda a suíte contra o emulador. Contra as rules **de antes** das correções,
oito casos passaram — promover-se a criador, gravar o `uid` de outra pessoa,
trocar o próprio e-mail pelo de outro. Contra as rules atuais: negam o que têm
de negar e deixam passar cadastro, pedido de cargo e notificação lida.

**Sobrou uma busca por e-mail**, em
[criar-personagem/js/firebase.js:91](criar-personagem/js/firebase.js:91): a mesa
guarda o e-mail do mestre em `createdBy` e a consulta serve só para mostrar o
nome dele na tela. Não decide permissão, e com o `email` preso ao token não dá
mais para forjar. Fica como dívida de arrumação, não de segurança.

---

## 🔴 3. Forja de item no Repertório pela Caixa do Mestre ✅ corrigido

**Onde:** [firestore.rules:157](firestore.rules:157) (`char` create),
[firestore.rules:196](firestore.rules:196) (`items` update),
[functions/index.js:705](functions/index.js:705) (`recusarItemDaMesa`),
[item-para-mesa.js:110](functions/item-para-mesa.js:110) (`devolverAoRepertorio`)

A cadeia:

1. O jogador manda 1 unidade de qualquer item para uma mesa. O servidor cria um
   doc em `items` com `characterId = "__caixa_mestre__<mesaId>"`, `ownerUid: ""`.
2. A rule de `items` permite atualizar se
   `get(char/$(resource.data.characterId)).data.ownerUid == request.auth.uid`.
   A rule de `char` permite **criar doc com ID arbitrário** desde que
   `ownerUid` seja o próprio. Então:

   ```js
   setDoc(doc(db,'char','__caixa_mestre__<mesaId>'), { ownerUid: meuUid })
   ```

   O atacante acabou de virar dono da Caixa do Mestre daquela mesa — de **todos**
   os itens que estão lá dentro, inclusive os de outros jogadores.
3. Ele edita o próprio item na caixa: `quantidade: 999` e
   `origemItemNome: "Pacote de 500 EXP"` (o nome exato da linha valiosa que ele
   já tem no Repertório).
4. `recusarItemDaMesa` devolve confiando nesses dois campos, e
   `devolverAoRepertorio` **soma na linha existente** — que carrega
   `isExp`/`expAmount`/`isExpVip`. 999 × 500 EXP, com log limpo em `exp_logs`.

O passo 4 depende de um mestre clicar em "recusar" — mas com o item 1 o atacante
é o mestre, e `exigirMestrePorQualquerCaminho` não confere de qual mesa.
Vale também sem nada disso: ele pode **apagar** os itens que outros jogadores
mandaram para a mesa.

**Feito em 31/08/2026** — três camadas, porque cada uma sozinha deixa metade
da cadeia de pé:

1. **A verdade da devolução mudou de lugar.** `enviarItemParaMesa` grava no
   aviso (coleção só-servidor) a peça que saiu do Repertório — nome, quantidade,
   descrição e imagem, por `pecaParaAviso()`. `recusarItemDaMesa` devolve a
   partir **do aviso**, e usa o doc de `items` só para confirmar que a peça
   ainda está na caixa e apagá-la. Também recusa se o `origemJogadorUid` do doc
   já não bate com o do aviso: peça trocada é o ataque.
2. **A caixa deixou de ser reivindicável.** `char` não aceita mais IDs no
   namespace do servidor (`__…`), e o atalho `get(char/...)` das rules de
   `items` não vale mais para peça em `__caixa_mestre__…`, nem no update nem no
   delete.
3. **Mestre de outra mesa não recusa mais.** `mandaNaMesa()` exige que quem
   recusa tenha criado aquela mesa (`mesas.createdBy`) — Criador continua
   passando em tudo.

**Provado nos dois níveis.** A forja está no
[item-para-mesa.test.mjs](functions/item-para-mesa.test.mjs), com o caso lado a
lado: pela peça do aviso a linha cara não encosta; lendo o doc de `items` como
antes, 1 unidade de bugiganga virava 1000 unidades de "Pacote de 500 EXP" —
500 mil de EXP. E no emulador, contra as rules antigas, os quatro passos da
cadeia **passaram**: criar o `char` falso, editar a peça na caixa e apagar peça
alheia. Contra as rules atuais, os quatro são negados e as 23 asserções fecham.

**Ficou de pé (item 5, não é desta correção):** 132 dos 243 documentos de
`items` apontam para um `characterId` que não existe mais em `char` nem em
`npcs` — restos de fichas apagadas e da coleção legada `characters`. Para cada
um desses IDs ainda dá para criar `char/<id>` e virar dono dos itens. A forja
morreu (a devolução não olha mais para o doc), mas a edição e o apagamento de
lixo alheio continuam abertos. A saída é faxina: item órfão não é renderizado
por tela nenhuma. **Não apaguei nada** — é decisão sua.

---

## 🟠 4. Webhook do Mercado Pago: sem assinatura, sem valor, sem estorno ✅ corrigido

**Onde:** [functions/index.js:1249](functions/index.js:1249)

O que está **certo** e vale registrar: o preço nunca vem do navegador
([validarLinhaCompra](functions/index.js:390)), o webhook reconsulta
`/v1/payments/{id}` com o token em vez de confiar no corpo, e a entrega é
idempotente. Isso já mata a fraude óbvia.

O que falta:

- **Sem validação da assinatura `x-signature`.** O endpoint é público e sem
  autenticação: qualquer um pode disparar milhares de POSTs, e cada um vira uma
  chamada à API do Mercado Pago. Custo, rate limit da conta e log poluído.
  Também dá para sondar existência de `paymentId` pela diferença entre o 404 e
  o 200.
- **Sem conferência de valor.** Nada compara `pay.transaction_amount` com
  `pending.cobradoCentavos`. É a checagem de uma linha que transforma "o MP
  disse approved" em "o MP disse approved **pelo valor que eu cobrei**".
- **Sem tratamento de `refunded` / `charged_back` / `cancelled`.** O jogador paga
  no cartão, recebe o EXP, aplica na ficha e pede estorno. O dinheiro volta e o
  benefício fica. Não existe caminho de reversão em lugar nenhum do código.

**Feito em 31/08/2026.** A parte que decide virou módulo puro em
[functions/mp-webhook.js](functions/mp-webhook.js), com 40 asserções em
`mp-webhook.test.mjs`:

1. **Assinatura.** `conferirAssinatura()` remonta o manifesto do MP
   (`id:<data.id>;request-id:<x-request-id>;ts:<ts>;`), calcula o HMAC-SHA256 e
   compara em tempo constante. Trocar o id do pagamento, trocar o request-id ou
   usar outro segredo derruba a conferência. Buffer de tamanho diferente não
   explode no `timingSafeEqual` — é o caso que costuma virar 500 em produção.
2. **Valor.** `conferirValorPago()` compara `transaction_amount` com
   `cobradoCentavos` (com fallback para `totalCentavos`, que é tudo o que as 4
   pendências da era pré-taxa têm). Pagar a mais passa; pagar a menos não
   entrega nada, marca a compra como `VALOR_DIVERGENTE` e chama o mestre.
   Tolerância de 1 centavo, porque o MP fala em reais com ponto flutuante.
3. **Estorno e chargeback.** `classificarPagamento()` reconhece `refunded`,
   `charged_back` e o estorno **parcial** — que não muda o status no MP, só
   aparece em `transaction_amount_refunded`. A compra vira `ESTORNADA`, entra
   um lançamento negativo em `real_logs` e o mestre recebe aviso (💸) dizendo
   se os benefícios já tinham sido entregues. `cancelled` em compra nunca
   entregue não é estorno — é pagamento abandonado, e não assusta ninguém.

A reversão **não** é automática, de propósito: EXP já aplicado numa ficha não
volta sem decisão de mesa. O servidor marca, registra e chama; quem decide é
o mestre.

**Ligado em 31/08/2026.** O webhook foi configurado no painel do Mercado Pago
(evento **Pagamentos**, URL de produção apontando para a function) e o valor
real entrou em `MP_WEBHOOK_SECRET` (versão 2), com a function redeployada.

**Verificado no ar, de fora**, depois que o segredo real entrou:

| Requisição | Antes | Depois |
|---|---|---|
| Evento de pagamento **sem** assinatura | `ignored` (ia consultar a API do MP) | **401** |
| Assinatura forjada (`v1` zerado) | — | **401** |
| Assinatura malformada (`x-signature: lixo`) | — | **401**, e não 500 |
| Evento que não é pagamento | `ignored` | `ignored`, antes de qualquer trabalho |

O caso da malformada importa mais do que parece: é onde a implementação ingênua
estoura no `timingSafeEqual` comparando buffers de tamanhos diferentes e devolve
500 — o que faz o MP reenviar a notificação em laço.

O outro sentido — assinatura **válida** passar — só o MP consegue produzir, e
por isso não foi testado daqui: quem tem o segredo é a conta, não este repo. O
botão **Simular notificação** do painel do MP fecha essa metade.

---

## 🟠 5. `npcs` e itens de NPC graváveis por qualquer autenticado ✅ corrigido

**Onde:** [firestore.rules:180](firestore.rules:180) e a cláusula
`exists(npcs/$(resource.data.characterId))` nas rules de `items`

```
match /npcs/{npcId} { allow update: if isSignedIn(); }
```

Qualquer jogador logado reescreve ou zera **qualquer NPC** do cenário — inclusive
os que guardam preparo de sessão. E como a rule de `items` trata "o characterId
existe em `npcs`" como autorização, qualquer jogador também edita e apaga os
itens de qualquer NPC.

**Feito em 31/08/2026 — a metade dos `npcs`.** O update deixou de ser aberto e
passou a ser recortado por campo: quem não é mestre só escreve
`valoresDer`, `conditions`, `lastUpdate` e `lastUpdateBy`. É exatamente o que o
Tabuleiro grava quando um jogador acerta um golpe (`valoresDer.atual.VIT`) ou
aplica uma condição — medido no código antes de escrever a regra, em
`patchVitalAtualNpc`. Nome, atributos, ataques, loot, `rolePlay`,
`visibilidade` e o vínculo de mesa ficaram só com o mestre.

A conferência de campo vem **primeira** no `||`: é de graça e é o caminho do
jogador em combate; só a edição completa paga o `exists()`/`get()`.

**Provado no emulador.** Contra as rules antigas, 19 casos passavam — entre eles
renomear NPC, reescrever atributos, mexer no loot, ler-e-reescrever os segredos
do `rolePlay` e desvincular o NPC da mesa. Contra as atuais, os 37 casos da
suíte fecham, incluindo três que existem só para provar que a regra não virou
um tiro no pé: **o mestre continua editando a ficha inteira, editando peça na
Caixa e apagando NPC**.

### A segunda metade: itens de NPC

**Fechada em 31/08/2026.** O impasse era de dado: a cláusula
`exists(npcs/$(characterId))` sustentava o inventário de aliado na ficha
([aliado-inventario.js](ficha-v1.7_1/js/aliado-inventario.js:323), onde o
jogador cria, edita e apaga), e nenhum NPC tinha campo de dono para pôr no
lugar dela.

Só que o vínculo **existia** — em outro formato. A ficha lista como aliado o
NPC que tem, em `vinculos`, uma entrada `{tipo:'personagem', id:<charId>}`
([aliados.js](ficha-v1.7_1/js/aliados.js:76)). Rules não sabem varrer lista de
objetos procurando um `tipo`; sabem fazer `in` numa lista de strings. Então o
vínculo foi achatado:

- Gatilho `espelharDonoDoNpc` resolve `vinculos` → `char/{id}.ownerUid` (com
  fallback para a coleção legada `characters`) e grava `donosUids`.
- A regra de `items` troca `exists(npcs/…)` por `ehDonoDoNpcAliado()`.
- `isMaster() || temPapelMestre()` entrou junto: sem o segundo, os dois mestres
  que não têm doc em `masters` perderiam a edição de item de NPC — que antes
  funcionava justamente pela cláusula aberta.

O gatilho recalcula a cada escrita no NPC, então **desvincular tira o acesso**
— testado em produção: desvinculei um aliado, `donosUids` esvaziou; revinculei,
voltou. A parte que decide é pura, em [npc-donos.js](functions/npc-donos.js),
com a trava do laço infinito coberta por teste (o gatilho grava no mesmo
documento que o acordou).

**O tamanho do que estava aberto:** dos 228 itens de NPC no banco, só **14** são
de NPC-aliado de alguém. Os outros 214 qualquer conta logada editava e apagava.
No emulador, contra as rules antigas, editar e apagar item de NPC alheio
**passava**; agora nega, e as 50 asserções da suíte fecham — incluindo as que
garantem que o jogador segue mandando no inventário do próprio aliado, mesmo em
item que o mestre criou.

**Nota de método:** entre a medição do item 3 e esta, a coleção `items` passou
de 243 para 436 documentos. O sistema está em uso; número de varredura é foto,
não retrato — remedir antes de decidir.

**Faxina feita em 31/08/2026.** Os itens órfãos foram apagados: **117 de 118**.
`items` foi de 436 para 319 documentos.

- **Backup antes**, em `functions/_backup-items-orfaos-<carimbo>.json` (fora do
  hosting e fora do git — 11 MB, e regenerável a partir do próprio banco).
- **1 foi preservado** por uma guarda que valeu a pena: o container
  "Saco de Luns Simples" ainda é o `parentItemId` de um item vivo. Apagá-lo
  soltaria um item de dentro de uma bolsa que existe.
- A coleção legada `characters` foi conferida antes: **nenhuma página a lê** —
  as ocorrências de `'characters'` no código são rótulo de log, não acesso a
  coleção. Os itens que apontavam para lá eram órfãos de fato.
- Depois: **nenhum** item vivo ficou apontando para container apagado. Havia
  uma referência quebrada (`avulso-1765749455992`), e ela **já estava quebrada
  antes** — confirmado contra o backup, o ID não está entre os apagados.

**Segunda faxina, em 01/09/2026:** os 14 documentos em `items` **sem
`characterId`** também saíram, com backup. `items` foi de 319 para **305**.

Correção de rumo que vale registrar: eu os havia descrito como "lixo com nome
`undefined`". Estava **errado** — o `undefined` era do meu diagnóstico lendo o
campo `nome`, e aqueles documentos usam o esquema antigo em inglês (`name`,
`quantity`). Todos os 14 tinham nome e conteúdo: "Ka'Lunis" ×999.997, "Lunis"
×99.235, "Loção de Cura Rápida" ×9.997, além de armas soltas — restos de teste
da era antiga, todos do criador e nenhum preso a ficha. Foram apagados com a
descrição certa na mesa, não com a errada.

O último órfão saiu em seguida: o container "Saco de Luns Simples", preservado
na primeira faxina por ter item vivo dentro — e esse item era justamente um dos
14, então o saco ficou vazio e a razão de mantê-lo acabou.

**Estado final de `items`: 304 documentos** — 62 de personagem, 228 de NPC, 14
na Caixa do Mestre, **zero órfãos**, zero sem `characterId`, zero apontando
para container inexistente. A coleção saiu de 436 e ficou inteira.

---

## 🟠 6. A coleção `users` inteira é legível ✅ corrigido

**Onde:** [firestore.rules:63](firestore.rules:63) — `allow read: if isSignedIn()`

Qualquer conta registrada lê o documento de todos os outros: e-mail, nome,
saldo de Frag$, Repertório completo, histórico de compras (`logsCompra`, com
valores em BRL) e as notificações. Uma consulta.

Isso já é exposição de dado pessoal e de histórico financeiro — e é o item que
mais importa para a frente de recuperação de conta (ver Pendências): **telefone
e WhatsApp gravados nessa coleção hoje nasceriam públicos para toda a base.**

**Feito em 31/08/2026.** A leitura virou `próprio documento || mestre ||
criador`. Duas telas de **jogador** liam dado dos outros e por isso precisaram
de uma projeção:

- **Metas** ([menu-firebase.js](menu/js/menu-firebase.js:1038)) — a soma é
  coletiva, precisa do apoio de todo mundo;
- **Tabuleiro** ([tab-main.js](tabuleiro/js/tab-main.js:162)) — o nome de quem
  está na mesa.

Nasceu `users_public/{uid}`, escrita SÓ pelo gatilho `espelharUsuarioPublico`,
com **três campos**: `displayName`, `apoios` e `atualizadoEm`. Ficaram de fora
e-mail, `fragmentos`, `inventario`, `logsCompra`, `notifications`, `role`,
`giros` e `rerolagens`.

Os apoios saem no **mesmo formato** que `shared/apoios-calc.js` consome
(`tipo`, `montante`, `meta`, `peso` — sem o `valor` em reais). Foi decisão de
projeto: somar no servidor obrigaria a copiar aquela matemática para
`functions/`, que é exatamente a divergência silenciosa que o cabeçalho do
`apoios-calc.js` conta ter acontecido quando cada tela fazia a própria conta.
Assim o cliente continua chamando `somarMetaTotais` sem uma linha de diferença.

O gatilho só grava quando a parte pública muda — sem essa guarda, cada
notificação nova (e são muitas) geraria escrita sem nada de novo dentro.

**Também saiu:** a última busca de pessoa por e-mail, em
[criar-personagem/js/firebase.js](criar-personagem/js/firebase.js:88), que
pegava o nome do mestre da mesa. Foi apagada em vez de adaptada — o
`mestreNome` já caía no `createdBy` da própria mesa, então a tela não mudou.
Era o resíduo apontado no item 2.

**Verificado no banco real**, depois do deploy: 18 espelhos para 18 usuários,
59 apoios de um lado e 59 do outro, **zero** campo sensível na projeção, e o
gatilho reagiu a uma troca de `displayName` em produção (alteração revertida na
sequência). Na suíte do emulador, 45 casos: jogador não lê doc alheio nem lista
`users`, mas lê `users_public` e não escreve nele; e o mestre continua listando
`users` e lendo o documento de um jogador, que é o que o painel faz.

**Agora a recuperação de conta pode andar** sem que telefone e WhatsApp nasçam
públicos — era este o pré-requisito. O campo novo entra em `users` (fechado) ou
numa subcoleção dele, e **nunca** no espelho.

---

## 🟠 7. reCAPTCHA falha aberto, e não há App Check nem rate limit ✅ parcial

**Onde:** [functions/index.js:43](functions/index.js:43)

```js
if (!secret) { console.warn(...); return; }   // secret ausente = passa tudo
```

Se `RECAPTCHA_SECRET` sumir do Secret Manager (rotação, projeto novo, deploy em
outro ambiente), a proteção anti-bot desaparece **em silêncio**. Fail-open em
caminho de pagamento devia ser fail-closed.

Somado a isso: nenhuma callable tem App Check nem throttling. Com um token de
login válido (cadastro é aberto), dá para chamar `criarCheckoutMercadoPago` em
laço — cada chamada cria uma preferência no MP e um doc em `compras_pendentes`.

**Feito em 31/08/2026 — duas das três.**

**1. O reCAPTCHA agora falha fechado.** Sem o secret, a compra para com aviso
ao jogador e `console.error` no log. Antes seguia em frente: se a chave sumisse
do Secret Manager (rotação, projeto novo, deploy em outro ambiente), a proteção
anti-bot desaparecia em silêncio — que é a pior espécie de falha, a que parece
estar protegendo.

**2. Freio por usuário no caminho de pagamento.** `criarCheckoutMercadoPago`
aceita **10 chamadas por hora por conta**. Folgado para quem compra de verdade
(o carrinho leva 20 linhas de uma vez) e apertado para laço. O freio roda
**antes** do reCAPTCHA de propósito: cada verificação custa uma chamada HTTP ao
Google, e quem está martelando não deve nem chegar lá.

A decisão é pura, em [rate-limit.js](functions/rate-limit.js), com 20 asserções
— incluindo as duas que a implementação ingênua erra: chamada **recusada não
incrementa** o contador (senão cada tentativa empurra o fim da espera para
frente, e a espera nunca acaba), e documento gravado "no futuro" (relógio
ajustado para trás) **não tranca** o usuário. Os contadores vivem em
`rate_limits`, sem leitura nem escrita pelo cliente: contador que o navegador
enxerga é contador que ele aprende a driblar.

Só o checkout ganhou freio, e isso é escolha, não esquecimento: as outras
callables já são limitadas pelo próprio saldo — girar exige giro, re-rolar
exige re-rolagem, comprar com Frag$ exige Frag$, aplicar EXP exige o item no
Repertório. O checkout era a única que criava recurso do nada.

### 3. App Check — PARADO em 31/08/2026, por decisão do Google

Tentado até o fim e desfeito. O motivo não é o projeto nem a configuração: o
**Google descontinuou o provedor reCAPTCHA clássico para App Check**. O painel
do Firebase ainda desenha o formulário ("Chave reCAPTCHA do secret", vida útil
do token), mas com os campos desabilitados e um aviso vermelho no topo —
*"reCAPTCHA is deprecated, please use reCAPTCHA Enterprise instead"*. Não há
como registrar o app por ali.

Antes de esbarrar nisso, o caminho todo foi percorrido: chave v3 criada no
projeto certo (com os dois domínios), módulo `shared/app-check.js` escrito e os
10 pontos de `initializeApp` do projeto ligados a ele. Tudo isso foi
**revertido e o hosting republicado**, porque em produção aquele código pediria
token a um provedor que não existe: erro no console de toda página, sem
proteger nada. Meia funcionalidade que só faz barulho é pior que nenhuma.

**O que sobrou de caminho:** reCAPTCHA Enterprise, que é o único provedor que o
App Check aceita hoje para web. Tem camada gratuita (10 mil verificações/mês,
muito acima do tamanho desta mesa) e o projeto já está no Blaze. A diferença
para o que foi feito: a chave se cria no console do **Google Cloud**
(Segurança → reCAPTCHA), não no `google.com/recaptcha/admin`, e o App Check
pede só o ID da chave — não há segredo para colar. No cliente muda uma linha:
`ReCaptchaEnterpriseProvider` no lugar de `ReCaptchaV3Provider`.

**Não é urgente.** O que segura o abuso na prática já está no ar: o freio de 10
checkouts por hora e o reCAPTCHA que parou de falhar calado. O App Check
protegeria contra chamada de fora do navegador com login válido — real, mas
uma camada acima do que já existe.

---

## 🟡 8. Storage aberto para escrita ✅ corrigido

**Onde:** [storage.rules](storage.rules)

Todo caminho útil é `allow write: if request.auth != null`, sem limite de
tamanho, sem limite de tipo e sem dono:

- `app-assets/favicons/**` e `app-assets/portal-hero/**` — **leitura pública**.
  Qualquer jogador troca o favicon e as imagens do hero do Portal. Defacement da
  primeira tela, antes do login.
- `loja-itens/**` — trocar a imagem de qualquer item da Loja.
- `imagens/**`, `tabuleiro-images/**`, `worldbuilding-images/**` — sobrescrever
  arquivo alheio (o nome é previsível) e subir arquivo arbitrário no domínio do
  projeto, que é um hospedeiro de phishing com o seu nome no endereço.

**Feito em 31/08/2026.** Três recortes: **o que** pode ser gravado, **por
quem** e **de que tamanho**.

- **Só do Criador:** `app-assets/favicons/**` e `app-assets/portal-hero/**` —
  os dois de leitura pública, os dois aparecendo antes do login. Era por ali
  que se desfigurava a primeira tela do site.
- **Só de mestre ou criador:** `loja-itens/**` (foto de item que se vende por
  dinheiro real), `runic-elements/**`, `hexmap-terrain/**` e
  `worldbuilding-images/**`.
- **Continuam de jogador:** `char-images/**`, `tabuleiro-images/**` e
  `imagens/**` — é o jogador que sobe a cara do personagem, do item e do token.
- **Em todos:** só `image/*`, e até 10 MB.

O teto de 10 MB não é o que o relatório propunha (5 MB): o cliente já recusa
acima de **8 MB** e usa `accept="image/*"`
([campo-imagem.js](shared/campo-imagem.js:30)). A regra fica acima do limite do
cliente de propósito — ela existe para o que não passa pelo cliente, não para
brigar com upload legítimo. A 5 MB, mapa de Tabuleiro válido seria recusado.

O papel vem do Firestore, com `firestore.get(...).data.get('role','')` — e o
`.get(chave, padrão)` importa: com `.data.role` direto, todo jogador (que não
tem o campo) fazia a regra **errar** em vez de devolver falso. O resultado
imediato seria o mesmo, porque erro nega; o problema é o dia em que alguém
puser outra condição ao lado num `||` — erro derruba a expressão inteira. Isso
apareceu no emulador e está corrigido.

**Provado no emulador de Storage**, 20 casos em
[storage.rules.test.mjs](storage.rules.test.mjs): jogador não troca favicon,
hero, item da Loja, glifo, terreno nem imagem do Cronista; mestre não troca
favicon (é do Criador); não entra arquivo que não é imagem, nem acima de 10 MB,
nem em caminho fora dos previstos. E o que tem de funcionar funciona — jogador
sobe personagem, item e token; mestre sobe item da Loja e terreno; criador
troca favicon, hero e glifo; e o hero continua sendo lido **sem login**.

---

## 🟡 9. `escapeHtml()` não escapa aspas ✅ corrigido

**Onde:** [menu-firebase.js:1357](menu/js/menu-firebase.js:1357) e a cópia em
[painel-mestre/js/area-apoio.js](painel-mestre/js/area-apoio.js)

```js
function escapeHtml(text){ const d=document.createElement('div'); d.textContent=text; return d.innerHTML; }
```

`textContent → innerHTML` escapa `<`, `>` e `&`, mas **não escapa `"`**. E a
função é usada dentro de atributos com aspas duplas:

```js
<img src="${escapeHtml(item.imagem)}" ...>            // :541, :1436, :1511
<div class="loja-card" data-loja-item="${escapeHtml(item.id)}">
```

Um valor como `x" onerror="…` sai do atributo. Hoje a porta depende de escrever
em `loja_itens` ou em `system/data/*` — o que os itens 1 e 5 entregam. O
`shared/inventario-motor.js:51` já tem o `esc()` correto, com `"` e `'`.

**Feito em 31/08/2026.** As duas cópias quebradas
([menu-firebase.js](menu/js/menu-firebase.js:1370) e
[painel-mestre/js/ui-utils.js](painel-mestre/js/ui-utils.js:20)) passaram a
escapar `&`, `<`, `>`, `"` e `'`.

Não foi por importação de `shared/inventario-motor.js`, como o relatório
propunha: aquele módulo é o motor de inventário inteiro, e puxá-lo para o
bundle do Portal por causa de quatro linhas custa mais do que resolve. As
cópias ficaram, agora todas iguais e todas corretas.

**O que mudou de verdade foi ganhar um vigia.** Nasceu
[escape-html.test.mjs](escape-html.test.mjs): varre o projeto, acha todo helper
de escape (`esc`, `escHtml`, `escapeHtml`, `escapeHTML`) e cobra que escape
aspas duplas. O **como** é livre — `.replace(/"/g,'&quot;')` direto ou
`textContent` seguido do replace das aspas, tanto faz; o que se cobra é o
resultado.

O lint se pagou na primeira execução: achou **11** helpers, contra os 6 que o
grep tinha encontrado. E rodando contra o código de antes da correção, aponta
exatamente as duas cópias quebradas.

Por que um vigia e não só a correção: das seis cópias que eu conhecia, quatro
**já tinham sido consertadas à mão**, cada uma com o próprio comentário
explicando o mesmo problema. Isso volta sozinho quando ninguém está olhando.

**Sobra uma aresta:** duas implementações (`shared/campo-imagem.js` e
`criar-personagem/js/app.js`) escapam aspas duplas mas não simples. Servem aos
atributos com `"`, que são a maioria — mas o projeto tem
`onclick="fn('${...}')"` em alguns lugares, e ali aspa simples ainda quebra. O
lint não cobra isso hoje para não reprovar código que funciona; fica anotado.

---

## 🟡 10. Sem verificação de e-mail ✅ corrigido

`createUserWithEmailAndPassword` sem `sendEmailVerification`, e nenhuma tela
checa `emailVerified`. Dá para registrar com o e-mail de outra pessoa — e o
método 2 do `findUserDoc` (busca por e-mail) faz disso mais um caminho de
confusão de identidade. Também é pré-requisito de qualquer recuperação de conta
por e-mail (ver Pendências).

**Feito em 31/08/2026** — e a medição mudou o desenho: **zero das 19 contas**
tinham e-mail confirmado, a do criador inclusive. Bloquear compra por
`emailVerified` naquele dia trancaria a Loja para a mesa inteira.

Então a régua é por **data de criação da conta**:

- O cadastro agora manda `sendEmailVerification`. Falhar no envio não derruba a
  criação da conta — ela já existe, e a faixa abaixo resolve.
- Faixa no topo do Portal para quem ainda não confirmou, com botão de reenviar
  (e mensagem específica para o `auth/too-many-requests` do Firebase, que
  aparece em reenvio seguido e viraria um "erro" sem sentido).
- No servidor, `exigirEmailVerificado()` cobra a confirmação nas duas compras
  (Frag$ e dinheiro) **só de contas criadas a partir de 01/09/2026**. As 19
  antigas seguem comprando.

A data vem do **Auth** (`getUser().metadata.creationTime`), não do campo
`createdAt` do documento: aquele o próprio dono escreve, e antedatá-lo pularia
a regra.

---

## 🟡 11. Empilhamento do Repertório por `nome` ✅ corrigido

**Onde:** [entrega-calc.js:41](functions/entrega-calc.js:41),
[exp-item.js:68](functions/exp-item.js:68), [roleta-sorteio.js:80](functions/roleta-sorteio.js:80)

Todo o Repertório é indexado por **nome de item**, e a linha existente mantém os
campos dela — só a quantidade cresce. Se dois itens da Loja tiverem o mesmo
`nome` (um barato sem EXP e um caro com `expAmount: 500`), comprar o barato soma
unidades na linha cara. Não é atacável de fora hoje, mas é um erro de cadastro
que vira EXP grátis, e é o que torna o item 3 lucrativo.

**Feito em 01/09/2026 — e não por `itemId`, como estava proposto.** A medição
matou aquele plano: das 43 linhas de inventário, **nenhuma** tem id, e **13**
têm nome que não existe mais no catálogo (prêmio de roleta, devolução do
mestre, EXP devolvido no encerramento de personagem). Não há de onde tirar id
para 30% delas — a migração não tinha como ser completada.

O que importava não era o empilhamento e sim o que ele **herda**: ao fundir,
a linha que sobrevive é a antiga, com os campos dela. A correção é essa:
**só empilha o que é a mesma coisa** — mesmo nome não basta, o que o item FAZ
tem de bater ([repertorio.js](functions/repertorio.js), aplicado nos três
caminhos que premiam: compra em dinheiro, compra em Frag$ e prêmio da roleta).
Itens homônimos com efeitos diferentes viram duas linhas, que é o que eles são.

`itemId` passou a ser gravado nas linhas novas e, quando os dois lados o têm,
manda — o nome pode até ser corrigido no catálogo sem partir a linha de
ninguém. A tela agrupa pela mesma regra, senão dois itens diferentes virariam
um card só com a etiqueta de um e a quantidade dos dois.

**Uma armadilha que só o banco real mostrou:** o catálogo grava `expAmount: 0`
e `roletaGiros: 0` em item que não concede nada, enquanto a linha antiga do
jogador simplesmente não tem o campo. Tratar zero e ausente como coisas
diferentes partiria **19 das 30** linhas em duas na próxima recompra. Zero e
ausente agora são a mesma coisa, e o caso está no teste.

**As 3 linhas legadas foram corrigidas em 01/09/2026**, com backup antes:
"Re-rolagem" e "Desejo Narrativo" (só etiqueta — o saldo de re-rolagem e os
giros são creditados na compra, não na linha) e "EXP" ×2 do criador, que passou
a valer 4 EXP aplicáveis. As 30 linhas que casam com o catálogo agora carregam
`itemId`; as 13 que não casam continuam como estão, e é o certo — são prêmio,
devolução do mestre e EXP de encerramento, que não têm item de catálogo.

### O bug que apareceu na conferência

Ao verificar o resultado, o inventário do criador mostrou **três linhas "EXP"
separadas** (2, 1 e 1) — o painel do mestre acrescenta item ao Repertório sem
empilhar. Isso expôs um defeito antigo em
[exp-item.js](functions/exp-item.js), independente do item 11:

- `disponivel` era lido da **primeira** linha encontrada. Quem tinha 4 unidades
  em três linhas só conseguia aplicar 2.
- `consumirUnidades` subtraía a quantidade pedida de **cada** linha com aquele
  nome. Gastar **1** unidade das 4 deixava **1**: duas unidades de EXP pago
  evaporavam em silêncio.

Agora linhas iguais são um poço só: soma para saber quanto há, consome em
ordem, e homônimo com outro efeito não entra no poço. Medido antes e depois —
com 3 linhas (2,1,1), gastar 1 deixava 1 unidade; agora deixa 3.

**A raiz também foi tapada.** O painel do mestre dava `push` direto no
inventário ao conceder um item, criando linha nova a cada vez — foi assim que
nasceram as três "EXP". Agora ele empilha, pela mesma regra do servidor.

Para não virar uma terceira cópia da regra, ela saiu para
[shared/repertorio-linha.js](shared/repertorio-linha.js), usada pelo Portal e
pelo painel do mestre. `functions/repertorio.js` continua existindo porque
`functions/` sobe sem a pasta `shared/` e é CommonJS — não há import possível
entre os dois. **O teste compara os dois gêmeos** em 256 pares de entradas: se
divergirem, fica vermelho.

**E o banco foi consolidado:** uma conta tinha 16 linhas, virou 14 (as três
"EXP" viraram uma de 4 unidades). Backup antes, e a conferência que importa —
o total de unidades não mudou: 22 antes, 22 depois. Nenhum par repetido
sobrou em nenhuma conta.

---

## 🟡 12. Documentos internos servidos em produção ✅ corrigido

`firebase.json` publica a raiz (`"public": "."`). `README.md`,
`RELATORIO-PROTECAO.md`, `CLAUDE.md`, `DESIGN-SYSTEM.md` e
`prompts-premios-roleta.md` estavam acessíveis por URL direta. O README
documenta o mecanismo do código de mestre; o `prompts-premios-roleta.md` lista
os prêmios da roleta.

**Feito nesta varredura:** `"**/*.md"` entrou no `ignore` do hosting. Nenhuma
página do site busca `.md`, então nada quebra.

---

## 🟢 13. `logs` com create aberto ✅ corrigido

`allow create: if isSignedIn()`, sem nenhuma conferência.

A medição mostrou que o create **tem** de continuar aberto: são 5.525
documentos, escritos por 6 pessoas — a ficha registra cada mudança que o
JOGADOR faz ([char-logger.js](ficha-v1.7_1/js/char-logger.js:359)), não só o
painel do mestre. Fechar para mestre quebraria a trilha inteira.

**Feito:** o campo `user` agora tem de ser o e-mail do próprio token. Dava para
gravar log assinado com o endereço de outra pessoa — numa coleção que existe
justamente para dizer quem fez o quê. Somado a isso, teto de 24 chaves, `action`
até 1000 caracteres e `timestamp` obrigatório. A leitura passou a aceitar os
dois caminhos de ser mestre: com só `isMaster()`, 2 dos 3 não liam a própria
trilha.

Os dois escritores foram ajustados para mandar sempre o e-mail autenticado, e
não o parâmetro recebido.

**O que continua possível:** encher a coleção de documentos válidos. Isso é
volume, não forja — a resposta para volume é o App Check (item 7), não regra.

## 🟢 14. `inventario` e `apoios` sem teto ✅ corrigido

`notifications` tem corte em 100; `inventario`, `apoios` e `logsCompra` cresciam
sem limite no mesmo documento. Documento de usuário morre em 1 MB — e morrer ali
significa não conseguir mais **nem comprar**.

**Medido antes de mexer, e o item estava superestimado:** o maior documento de
usuário tem **50 KB de 1024 KB (5%)**. O maior `logsCompra` tem 16 linhas. O que
mais pesa são as `notifications`, que já eram capadas — 100 delas dão ~39 KB.

Então nada foi reestruturado. `logsCompra` ganhou teto de 100, pelo mesmo
critério das notificações, porque é a **única lista do documento que só cresce
por desenho**: inventário sobe e desce, apoio acompanha a meta, compra nunca é
desfeita. Cortar não perde história — a trilha completa e imutável está em
`real_logs`/`frag_logs`; o que fica no documento é a cópia que o painel do
mestre desenha.

`inventario` e `apoios` ficaram como estão: são estado de jogo, não histórico,
e capar significaria apagar coisa que o jogador tem. Se um dia um documento
passar de ~300 KB, aí sim vale mover `inventario` para subcoleção.

---

## Ordem sugerida de execução

**Hoje, meia hora, sem migração** — fecha os dois piores buracos e o vandalismo:

1. ✅ `role`, `uid` e `email` protegidos no `create` e no `update` de `users`
   (itens **1** e **2**).
2. ✅ `MASTER_SECRET_CODE` apagado; cadastro virou pedido de cargo (item **1**).
3. ✅ `npcs` fechado por campo e itens de NPC presos ao dono do aliado
   (item **5**).
4. ✅ Storage: limite de tamanho e content-type; caminhos de administração só
   para criador/mestre (item **8**).
5. ✅ Escape de aspas nas duas cópias quebradas, com lint que impede a volta
   (item **9**).

**Esta semana** — exige tocar em função:

6. ✅ `recusarItemDaMesa` devolve pelo aviso, não pelo doc de `items` (item **3**).
7. ✅ Webhook: assinatura, conferência de valor, status de estorno (item **4**).
8. ✅ reCAPTCHA fail-closed e freio de 10 checkouts/hora (item **7**). App
   Check parado: o Google descontinuou o provedor reCAPTCHA clássico, e o que
   resta é o Enterprise.

**Frente própria** — mexe em dado existente:

9. ✅ `users/{auth.uid}` como única forma de achar o jogador (item **2**) — não
   precisou de migração.
10. ✅ Leitura de `users` fechada e `users_public` criado (item **6**) — o
    pré-requisito da recuperação de conta está pago.
11. Empilhamento por `itemId` (item **11**) e teto de arrays (item **14**).

---

## Pendências desta sessão

### Recuperação de conta ✅ feita em 01/09/2026

Não existia **nada**: quem esquecia a senha perdia o Repertório comprado com
dinheiro real. Agora são três caminhos, do mais barato ao mais caro:

**1. "Esqueci minha senha", na tela de entrada.** `sendPasswordResetEmail` do
próprio Firebase. Resolve o caso comum sem acionar ninguém. A resposta é a
mesma para e-mail existente e inexistente — dizer "conta não encontrada"
transformaria a tela num verificador de quem tem conta aqui.

**2. Contatos de recuperação**, na janela 👤 **Minha conta** do Portal:
WhatsApp e e-mail alternativo, mais o estado da confirmação do e-mail e um
botão de trocar a senha sem deslogar. Os campos moram em `users/{uid}`, que o
item 6 fechou — só o dono e o mestre leem. **Não entram no espelho público**, e
há teste garantindo isso.

**3. Link de redefinição gerado pelo Criador**, no Painel → Permissões, para
quem perdeu o acesso ao próprio e-mail. `gerarLinkDeRecuperacao` devolve um
link do Firebase que o Criador manda pelo WhatsApp cadastrado.

O desenho do caminho 3 tem uma propriedade que vale enunciar: **ninguém vê nem
digita senha alheia**. O link leva a pessoa à tela do Firebase, onde ela
escolhe a própria. O Criador nunca fica com acesso à conta. E: só Criador
gera, nunca em outro Criador (seria o caminho curto para um assumir a conta do
outro), e cada geração deixa trilha imutável em `recuperacao_logs` — com quais
contatos estavam cadastrados na hora, que é o que permite contestar depois.

### As três decisões, e o que foi decidido

- **Onde o telefone mora:** em `users/{uid}`, junto do resto, porque aquele
  documento já está fechado. Subcoleção seria mais apertado e não paga o custo.
- **Verificação do número:** **não tem.** Verificar exige SMS (Firebase Phone
  Auth, custo por mensagem), e número não verificado é só um campo de texto.
  Por isso ele **não é fator automático de recuperação** — é canal de contato
  para o mestre reconhecer a pessoa.
- **WhatsApp automático:** **não.** É o caminho mais fácil de sequestrar uma
  conta. A recuperação por esse canal é manual, feita por um Criador que
  reconhece quem está pedindo, e registrada. No tamanho desta mesa, o
  reconhecimento vale mais que um código.

**O que NÃO foi verificado ao vivo:** a janela "Minha conta" e o botão de
recuperação no Painel exigem sessão logada, e eu não tenho credencial. O que dá
para checar de fora foi checado — as funções existem no bundle servido, o
"Esqueci minha senha" responde certo com campo vazio, a callable recusa quem
não está logado, e as 63 asserções de rules cobrem a privacidade dos contatos.
Falta você abrir as duas telas uma vez.

**Se um dia virar automático:** código de uso único, validade curta, limite de
tentativas e envio pelo servidor. Nunca um número não verificado bastando.

### Achado de dados: três contas com o mesmo e-mail

`eliesiorocha4@gmail.com` tem **três** contas no Firebase Auth. Duas têm
documento em `users` (`C1FK6wWV2Gg…` e `x40bX21pw8c…`); a terceira
(`t1XT9y2onjO…`, criada e usada uma única vez em 09/11/2025) não tem nenhum.

Enquanto o fallback por e-mail existia, essa terceira conta entrava e recebia
**o documento de uma das outras duas** — qual delas, dependia da consulta. Com a
correção do item 2 ela passa a ter o próprio documento, vazio, criado no
primeiro acesso. Nada foi perdido: o que estava nos outros dois documentos
continua lá, e continua acessível entrando pelas contas correspondentes.

Não mexi nesses dados — decidir qual conta é a boa e apagar as outras é chamada
sua. Se quiser, eu junto os Repertórios num só e removo as sobras.

### Também ficou anotado

- Item **11** (empilhamento por `itemId`) e item **14** (teto de arrays) são a
  mesma frente de migração do Repertório — fazer juntos.
- Sem reversão de estorno (item **4**) não há caminho para tirar um benefício já
  aplicado numa ficha. Vale decidir a regra de mesa antes de codar: reverter EXP
  já gasto ou cobrar a diferença.
