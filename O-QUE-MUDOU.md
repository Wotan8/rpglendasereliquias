# O que mudou — Núcleo v2 (04/09/2026)

Resumo por página do site: o que ela faz agora, o que mudou nesta refatoração e o que você precisa saber. A regra de jogo vigente é o **Livro de Regras do Jogador 2.00** no Cronista (os capítulos 2 a 8 são o Livro de 12 Páginas). O banco foi migrado em 8 passos com backup de cada um em `D:\Imagem\US - Universo Soberano\RPG\Reliera\Backup Firestore 2026-09-03\scripts-backups` (e um dump completo de antes de tudo na pasta acima).

## Portal (`index.html`)

**Faz:** login e menu para as páginas. **Mudou:** nada de tela. O `sw.js` subiu para v388 e pré-carrega os módulos novos (`shared/poder.js`, `shared/regras-padrao.js`, `shared/campos-cadastro.js`, `shared/dominio-redutor.js`, `ficha-v1.7_1/js/poder-ficha.js`). **Saber:** na primeira visita depois do deploy o app recarrega uma vez sozinho (troca de cache).

## Criador de Personagem (`criar-personagem/`)

**Faz:** o assistente de criação. **Mudou:** perícias em quatro grupos de oito (6/4/3/2 pontos, teto 3 e nunca acima do atributo; a 5ª bolinha custa 1) mais a Perícia de Escola da classe; os Domínios não existem mais (a perícia é a porta); classe com mais de um ramo opcional (Xamã) pede o **ramo inicial** nos detalhes da classe e não deixa avançar sem escolher; habilidade de ramo custa **Qualidade × 4 EXP**; a Energia da ficha nova já sai como PRS + AUT + melhor Perícia de Arte. **Saber:** tudo vem de `config/regras` (aba Regras do Criador) — mudar um número lá muda o assistente.

## Ficha (`ficha-v1.7_1/`)

**Faz:** a ficha do jogador. **Mudou:**
- **⚡ Poder · Patamar** ao lado da Experiência: tudo que a ficha tem, em EXP (Livro cap. 3) — atributos desde o nível 1 (concedido), perícias, Dons pelo preço do cadastro (desvantagem conta 0), habilidades de ramo e itens. O detalhe abre no mesmo tooltip da Experiência. Não trava nada, e não soma o EXP Restante (ainda não virou ficha): Poder ≈ EXP gasto, e passa dele quando a ficha tem item ou habilidade paga a preço antigo.
- **Três defesas** na aba Combate: Esquiva, Aparar e Bloquear = nível da perícia (Bloquear + Qualidade do escudo, teto VIG). Desviar, Evadir, Proteger, Cobertura e Absorver saíram como VDs.
- **Energia** = PRS + AUT + melhor Perícia de Arte. **Graça de Palla saiu**; as preces pagam Energia.
- **Contadores de cena**: Carga de Sangue (ex-Bolha de Sangue, teto VIG + Hemomancia) e Harmonia (teto Sonoromancia). Começam em 0 e zeram no fim da cena (no Tabuleiro).
- **Ferimento** automático pela Vitalidade (Ferido −1 / Grave −2 / Beira da Morte com Desvantagem / Morrendo) e **Sobrecarga** automática pelo peso acima da Carga (3 níveis). Entram e saem sozinhos na lista de condições.
- **Itens**: Qualidade 0–5, Afiação comum e arcana (com Essência), Encantamento, Aura da peça (Q6–10), estado Danificada (−1 Q até um ferreiro). Liga, Integridade e blindagemQ0 saíram; contêiner não rompe mais.
- **Ramo opcional** fechado aparece com "🔓 Comprar ramo — 10 EXP" (exige Perícia da Escola 2).
- **Aliados**: o card mostra o limiar de Lealdade (máx(6, 10 − Perícia da Escola)) e "🔗 selado".
- Consumível com **potência de cura** tira Aflição de nível igual ou menor ao ser usado.
**Saber:** a ficha recalcula o Ferimento ao mudar a Vitalidade e a Sobrecarga ao mexer no inventário; se uma condição automática parecer errada, corrija o número que a gera (Vitalidade/peso), não a condição.

## Painel do Criador (`painel-criador/`)

**Faz:** todo o cadastro do sistema. **Mudou:**
- Abas novas **Regras** (todos os números do sistema, `config/regras`), **Campos** (campos configuráveis por cadastro, ex.: bloco Lore do NPC), **Escolas** (perícia, Forma, Tributo, Leis, Desastre, compêndio) e **Ramos e Módulos**.
- **Perícias**: 32 gerais + 8 de Escola; flag **Arte** (armas e escolas — a melhor entra na Energia).
- **Equipamento**: campos Perícia de Arte (a porta), Afiação arcana + Essência, Encantamento, imunidade a condição, Vantagem em perícia, Aura, Danificada (só na instância), potência de cura; saíram Liga, Integridade máxima, blindagemQ0.
- **Condições**: portão (direto / corpo / mente / nenhum), Desvantagem, Aflição (piora, cura por potência, desfecho), níveis com Desvantagem a partir de N, trilha automática (Ferimento / Sobrecarga), teste para sair com "só decide o efeito", falha → condição e Teste de Morte.
- **Módulo de classe**: Escola, perícia herdada da Escola, ramo opcional, retorno fixo (Harmonia), e no predef: condições aplicadas (nível, rodadas, alvos, facção, sai ao agir), escolha exclusiva e "enche um contador".
- **Valores Derivados**: contador de cena e Clímax.
- Saíram a aba Manobras (coleção vazia) e a opção de limite "teto só de itens".
**Saber:** o portão da condição mora na condição, não na habilidade; a habilidade só diz quem leva. Toda mudança de cânone sobe a versão do documento (escada 1.02 → 1.03).

## Painel do Mestre (`painel-mestre/`)

**Faz:** mesas, NPCs, inventários, avisos. **Mudou:** o bloco de Lore do NPC vem do cadastro de Campos (aba Campos do Criador); NPCs carregam Perícias de Escola e Percepção/Lábia/etc. com os nomes novos; o motor do NPC resolve Melhor Perícia de Arte, Item: Qualidade efetiva (Aura, Danificada), Reforço e Afiação arcana; o ⚡ Poder do card soma itens quando o inventário está carregado. **Saber:** NPC não tem porta de Arte nem ramo opcional (o mestre vê tudo).

## Tabuleiro (`tabuleiro/`)

**Faz:** a mesa virtual. **Mudou:**
- **Conflito**: só quem tem corpo livre esquiva, só quem tem arma na mão apara, só quem tem escudo bloqueia; Bloquear não vale contra magia. 1 defesa grátis por rodada (2 com escudo, se for Bloquear); extras custam Energia. **Crítico** = Alvo + 2 Graus e dado cheio, mas Defesa maior segura. **Evadir** (Esquiva que segura: até 2 m de graça), **Proteger** (quem tem escudo ao lado bloqueia pelo aliado e leva o dano), **contra-ataque** é o trunfo do Aparar (dado da arma + Aparar − Blindagem).
- **Dano**: Blindagem única; dano de Essência (magia, runa, Afiação arcana) só a Blindagem Arcana barra.
- **Condições** com portão: corpo compara Graus com VIG, mente com PRS (+1 por vez que a mesma condição já pegou na cena); crítico sempre pega; imunidade da peça vestida barra. Mesma condição de duas fontes: vale o maior nível (Aflição soma).
- **Desvantagem** (Prostrado, Cego, trilha nível 3) rola dois d10 e fica o pior — no acerto, na conjuração e no teste da cena.
- **Ferimento** entra e sai sozinho pela Vitalidade; **Beira da Morte** pede PRS + Resiliência no início do turno (falhou → Acuado); **Morrendo** pede o Teste de Morte (VIG + PRS): passou +1 Vitalidade, falhou conta a queda.
- Testes de **início e fim de turno** passam a ser pedidos na virada.
- **Contadores de cena** zeram ao iniciar e ao encerrar a cena; **Clímax** do Bardo (gastar toda a Harmonia antes de rolar: cada ponto vira 1 Grau); Harmonia +1 por canção que passa, seja qual for a moeda; errou, zera.
- **Duas armas** de uma mão: −3 no Alvo, −1 por nível do Dom Ambidestria.
- **Desastre** (10) come 1 de Afiação da peça, depois marca Danificada.
**Saber:** nada disso é fixo no código — `config/regras` (aba Regras) tem cada número.

## Cronista / Wiki (`worldbuilding/`)

**Faz:** livros e artigos. **Mudou:** Livro do Jogador 2.00 (caps 2–8 = o Livro de 12 Páginas; guias do site renumerados 9–11, com "O que mudou na ficha"); Compêndios sem Dissonância, sem Dívida Espiritual, sem ±1 das Vozes e sem Graça; Régua de Balanceamento 1.03 com aviso de Núcleo v2 nas seções antigas e o capítulo 14 (Contadores e trilhas); Bestiário com Sangrando e nota de leitura v2; Livro de 12 Páginas marcado como aprovado. **Saber:** o HTML anterior de cada capítulo está no backup `_backup-livros-*.json`.

## Loja, Laboratorium, Mapa de Conflito

**Faz:** o mesmo de antes. **Mudou:** só o vocabulário que herda do cadastro (perícias, Carga de Sangue, condições). O Laboratorium continua lendo os elementos rúnicos; runas não têm mais "chance" — a condição pega pelo portão dela contra o Alvo gravado na runa.

## Servidor (`functions/`) e regras do Firestore

**Faz:** roleta, pagamentos, sorteios. **Mudou:** a coleção `characters` (legado) foi migrada para `char` e apagada; `config/regras` e `config/campos` podem ser editados pelo Criador (rules). Os scripts `functions/v2-*.mjs` são a migração (com `--dry-run` padrão e `--apply`); os scripts antigos `__*` e os `_backup-*.json` foram para a pasta de backup no D:.

## O que ficou de fora (e por quê)

- Vantagem por perícia via Encantamento e imunidade a condição já existem no cadastro do item; a imunidade já barra no Tabuleiro, a Vantagem por perícia ainda não entra na rolagem (o teste da cena não sabe qual perícia rolou).
- Descanso Rápido/Longo, Trauma (Gatilho/Origem/Intensidade), Fome/Sede/Exaustão são condições e regras de texto: o Narrador aplica.
- Tabela de Colapso: está no Livro (cap. 7); `knowledge` é regra de desbloqueio de capítulo, não tabela.
- Poder não soma aliados ainda (metade do Poder deles) — precisa das fichas de NPC carregadas na ficha.
- Cópias de item em mapas e NPCs mantêm campos velhos (`dominioId`, `liga`) que caem no modelo do catálogo; nada quebra, mas não foram migradas.
