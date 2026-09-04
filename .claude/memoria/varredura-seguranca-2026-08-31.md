---
name: varredura-seguranca-2026-08-31
description: Varredura de segurança 31/08–02/09/2026 — 14 de 14 fechados; método de provar rules no emulador; App Check em monitoramento.
metadata: 
  node_type: memory
  type: project
  originSessionId: fda1872e-a150-4c64-a2dd-5592eb95f180
  modified: 2026-09-03T02:22:25.532Z
---

Varredura adversarial gerou `SEGURANCA-VARREDURA.md` na raiz (fora do hosting:
`**/*.md` entrou no ignore do firebase.json). **14 achados, 14 fechados.**

**Fica esperando:** App Check ligado em **monitoramento** desde 02/09 — o site
manda token (reCAPTCHA Enterprise), mas Firestore, Storage e Auth seguem
`UNENFORCED`. Ligar a exigência é em degraus: callables de dinheiro primeiro,
Firestore/Storage depois, `identitytoolkit` (o login) por último ou nunca —
quem não obtiver token ali não entra nem para reclamar. As métricas ficam no
painel do App Check, e a config se muda por API (a conta de serviço escreve em
`firebaseappcheck`, mas toma 403 no `recaptchaenterprise`).

**Why:** o repo mostra o código corrigido, não o que já foi tentado, nem por
que uma correção parou onde parou, nem o que está esperando prazo.

**How to apply:** ler `SEGURANCA-VARREDURA.md` antes de mexer em rules,
`functions/index.js` ou fluxo de pagamento — cada item tem a cadeia de ataque
escrita e a razão da escolha. Regra de trabalho adotada: **provar no emulador
antes e depois**. `firestore.rules.test.mjs` (82 asserções) e
`storage.rules.test.mjs` (20) rodam a mesma suíte contra as rules antigas
(`git show HEAD:firestore.rules`) para demonstrar o furo, e contra as atuais
para demonstrar o conserto — sempre com casos garantindo que mestre e criador
continuam podendo o que precisam. Usa `firebase-tools@13` de propósito: o CLI
atual exige JDK 21 e a máquina tem 17.

**Armadilhas que se repetiram** e valem checar em qualquer regra nova:

- **Dois jeitos de ser mestre**: `isMaster()` (doc em `masters`) e
  `temPapelMestre()` (`role`). Dois dos três mestres não têm o doc — regra que
  só aceita um deles nega em silêncio. Aceite os dois, sempre.
- **Erro em rule envenena o `||` inteiro**: use `.data.get('campo','')`, nunca
  `.data.campo` de campo que pode faltar.
- **Número de varredura é foto, não retrato**: `items` foi de 243 → 436 → 304
  em dois dias. Remedir antes de decidir.

Frentes nascidas daqui, todas no ar: recuperação de conta (3 caminhos, senha
nunca passa por ninguém), menu da conta no nome do usuário, aviso de
Personagem Avulso, e o "+Avulso" do Painel do Mestre.

Relacionado: [[fila-de-pendentes]], [[pagamento-mercado-pago]],
[[avisos-do-mestre]], [[responsivo-sempre]].
