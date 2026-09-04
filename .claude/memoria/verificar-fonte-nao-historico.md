---
name: verificar-fonte-nao-historico
description: "Várias frentes mexem no mesmo Firestore ao mesmo tempo — reler o banco antes de afirmar, nunca repetir o que ficou no histórico da conversa."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 25c19abf-0c42-4793-838c-b5327406c291
  modified: 2026-08-08T13:10:59.688Z
---

Antes de afirmar qualquer coisa sobre o estado do sistema, **reler a fonte**
(Firestore, arquivo, artigo) na hora. O que eu li no começo da sessão pode ter
sido mudado por outro agente enquanto eu trabalhava em outra parte.

**Why:** o projeto roda várias sessões em paralelo sobre o mesmo banco —
condições, classes/magias, Runomancia, Alquimancia, Sangue. O Firestore é
compartilhado e não tem merge: quem grava por último vale. Repetir o histórico
da conversa produz recado errado para outra frente, que então trabalha em cima
de premissa morta.

**How to apply:** ao escrever recado para outra frente, relatório ou capítulo
de livro, cada afirmação factual sai de uma leitura feita naquele momento.
Erros já cometidos por não fazer isso: afirmei que as canções do Bardo tinham
ficado sem referente de Dissonância (ela já não existia em lugar nenhum) e que
seis habilidades continuavam reprovadas (as seis já tinham sido consertadas
pela frente de classes). Cuidado também com regex de verificação: procurar
`dissonan` casou com "GRITO DISSONANTE", nome de magia — falso positivo que
quase virou afirmação.

Vale igual para o que outra frente reporta sobre o meu trabalho: o recado dela
também pode estar velho. Conferir antes de aceitar ou recusar.

Relacionado: [[fontes-da-campanha-reliera]], [[nunca-inventar-lore]]
