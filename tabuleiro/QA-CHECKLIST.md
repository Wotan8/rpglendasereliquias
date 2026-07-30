# QA Checklist — Tabuleiro FASES 2–7

Teste com 2 navegadores: um no modo **secreto** (mestre) e um no **público** (jogador ou aba anônima logada como jogador).

## FASE 2 — Sincronização
- [ ] Mestre arrasta um token → no público ele desliza suave (~200ms), sem teleporte.
- [ ] Quem arrasta NÃO vê o próprio token "voltar" (anti-eco por `lastWriter`).
- [ ] Com luz dinâmica ativa, o fog do público NÃO pisca durante o arrasto — só recalcula ao soltar.
- [ ] Botão 👥 ligado: cursor do outro usuário aparece com nome/cor; para de aparecer ~15s após ele fechar a aba.
- [ ] Alt + duplo-clique cria ping animado em todos. Mestre com Alt+Shift+duplo-clique puxa a câmera dos jogadores.

## FASE 3 — Fog e visão
- [ ] Público: áreas nunca vistas = pretas; já vistas = escurecidas (sem tokens de inimigos); área atual = visível.
- [ ] Exploração persiste após F5 e é compartilhada entre jogadores (merge). "Resetar exploração" limpa tudo.
- [ ] Jogador só vê pelo(s) SEU(s) token(s); jogador sem token cai no fallback do grupo.
- [ ] Sensores: noturna enxerga sem luz; padrão precisa de luz (noite); tremorsense atravessa paredes; verInvisivel/verdadeira revelam token invisível.
- [ ] Luz com animação "tocha" tremula continuamente; luz colorida tinge a área; luz cônica gira com a Direção do token.
- [ ] Parede com elevação 5 não bloqueia token com elevação 0 (andarAltura padrão 5). Seletor "Andar ativo" (painel Camadas) esmaece o resto.

## FASE 4 — Grid e medição
- [ ] Config → grid hexagonal: grade desenha hexes, tokens encaixam no centro do hex, régua conta em hexes.
- [ ] Grid quadrada com diagonal 5-5-5 e 5-10-5 altera o valor da régua (3,4 células → 4 e 5.5).
- [ ] Ferramenta 🎯: arrastar cria círculo/cone/linha/retângulo; popup lista tokens atingidos; "Marcar alvos" põe anel laranja.
- [ ] Template com duração 2: expira sozinho quando a rodada avança 2 no combate.
- [ ] Ferramenta ⛰️: polígono amarelo hachurado (só mestre); régua e arrasto de token pagam x2 dentro dele.
- [ ] Arrasto de token: botão direito adiciona waypoint; custo acumulado no rótulo; fica vermelho ao exceder o deslocamento da ficha (se houver campo).
- [ ] Config → "Bloquear movimento": jogador não atravessa parede/porta fechada/janela (token volta + toast); mestre atravessa; porta aberta libera.

## FASE 5 — Tokens ↔ fichas
- [ ] Token de personagem mostra 3 barras (VIT/ENER/SAN) que atualizam ao mudar a ficha ou o combate.
- [ ] Config de barras por token (todos/dono/mestre/off) respeitada no público.
- [ ] Condições (da ficha e do combate) aparecem como ícones ao redor do token.
- [ ] Nome, barras e ícones mantêm o MESMO tamanho na tela em qualquer zoom.
- [ ] 🎁 Mostrar → cards de Equipamento têm botões 🖼️ (mostrar), 🧰 (dropar loot) e 📦 (mandar p/ Caixa do Mestre); os da Caixa têm 🖼️/🧰 e 📂 (abrir contêiner).
- [ ] Loot no mapa aparece SEM borda/nome — só a imagem do item (fallback 📦/🧰 sem imagem).
- [ ] Loot dropado da Caixa some da Caixa (e volta por "↩️ Devolver à Caixa" no botão direito do mestre).
- [ ] Jogador com "Interagir com o cenário" dá duplo-clique (ou toque longo) no loot e pega SEM escolher quantidade (fixa no que o mestre dropou); no modo Secreto o mestre edita a quantidade.
- [ ] Contêiner dropado: propriedades/baú têm "📌 Fixo no mapa"; fixo = jogador só pega o conteúdo; pegável = pode pegar o baú inteiro. Jogador precisa do token AO LADO do baú para abrir.
- [ ] Janela do baú também GUARDA itens: lista o inventário do alvo selecionado (soltos, não equipados, sem contêiner) e "⬇️ Guardar" move o item para dentro do baú.
- [ ] Arrastar loot sobre um token abre a entrega pré-selecionada e o loot some ao entregar.
- [ ] Botão direito num token abre o menu radial (ficha, iniciativa d20, visão, luz, invisível, condição, tamanho, elevação, remover).
- [ ] Participante ativo do combate ganha anel amarelo pulsante no mapa (público só se o combate estiver visível).

## FASE 6 — Ferramentas do mestre
- [ ] Alfinete: editar completo aceita imagem e vínculo com NPC; popup mostra imagem + botão "Abrir NPC".
- [ ] ⏱️ cria relógio; clique avança fatia; botão direito volta/zera; sincroniza no público (se visível).
- [ ] Mestre ativa outro canvas "📡": público faz fade → troca → espera mapas → fade-in.
- [ ] 🎬 Teleprompter: texto rola de baixo para cima em todos; "Parar exibição" remove.
- [ ] Config → Clima: chuva/neve/cinzas/névoa animam no canvas de todos.
- [ ] Imagem marcada como 🏠 telhado fica acima dos tokens e cai para 25% de opacidade quando um token controlado entra no retângulo.

## FASE 7 — Robustez
- [ ] `firebase deploy --only firestore:rules`: jogador não consegue alterar grid/permissões do canvas pelo console; consegue mover objetos e gravar exploração; legenda/estado só mestre.
- [ ] Ctrl+Z desfaz criação/exclusão/movimento/propriedade do mestre; Ctrl+Y refaz; trocar de canvas invalida a pilha com aviso.
- [ ] Celular: pinça dá zoom; segurar 0,5s abre menu; setas (teclado) movem token selecionado 1 célula com colisão.
- [ ] Upload de mapa com grade visível sugere "Detectamos grade ~Xpx" e dimensiona para casar com o grid.
- [ ] Shift+? abre a ajuda de atalhos.

## Regressões (FASE 1 e base)
- [ ] Pan/zoom fluidos com mapa 4k + 200 objetos; fog não recalcula ao apenas mover a câmera.
- [ ] Régua com vértices (botão direito) e modo caneta seguem funcionando, compartilhadas ao vivo.
- [ ] Porta: duplo clique abre/fecha e o fog reage na hora.
- [ ] Combate: janela flutuante, turnos, ±VIT/ENER/SAN refletindo na ficha.
- [ ] Mostrar NPC/item/caixa e entrega ao inventário como antes.
