---
name: avisos-do-mestre
description: "Canal jogador → mestre — fila em `avisos_mestre`, sino no painel; a regra tem de aceitar os DOIS jeitos de ser mestre."
metadata: 
  node_type: memory
  type: project
  originSessionId: f168345d-d579-4911-8ed6-0696886be3c1
  modified: 2026-08-26T05:36:26.104Z
---

Desde 26/08/2026 existe caminho de volta: o sistema sempre soube avisar o jogador (`users.notifications`), mas nada chamava a atenção do mestre. O canal é a coleção **`avisos_mestre`** — um doc por aviso, com `status: 'novo' | 'lido'`, escrita só pelo servidor. O helper `avisarMestre()` em `functions/index.js` aceita transação, então o aviso nasce na mesma gravação do fato que o originou.

No painel, é um sino com contador na barra do topo (não numa aba — aviso chega de qualquer canto), em `painel-mestre/js/avisos.js`. A escuta liga na entrada do painel, não ao abrir a janela: o contador só serve se avisar sem ser procurado.

**A armadilha que já custou tempo:** há DOIS jeitos de ser mestre neste projeto e eles não coincidem. `isMaster()` nas rules olha a coleção `masters`; o painel entra por `users.role in ['mestre','criador']`. Hoje são três mestres e só um tem doc em `masters`. Toda regra nova para o mestre precisa aceitar os dois caminhos (`isMaster() || temPapelMestre()`), senão dois deles ficam de fora em silêncio.

Corolário para teste: `igorateu888@gmail.com` tem papel **jogador**. O mestre de verdade é `igorestevamalvesdesouza@gmail.com`. Testar permissão de mestre com a conta errada dá 403 e parece bug de regra.

Produtores de aviso: entregar personagem ao mestre (`personagem-entregue`) e mandar item do Repertório para uma mesa (`item-para-mesa` — a peça cai na Caixa do Mestre traduzida por `functions/item-para-mesa.js`, com `origemRepertorio` marcado). O aviso de item tem botão **Recusar**: a callable `recusarItemDaMesa` devolve as unidades ao Repertório (merge pelo `origemItemNome`), apaga a peça da caixa e notifica o jogador, numa transação só — e nega a recusa se a peça já saiu da caixa, senão arrancaria o item de quem o recebeu.

Relacionado: [[roleta-dos-apoiadores]], [[npc-em-varias-mesas]].
