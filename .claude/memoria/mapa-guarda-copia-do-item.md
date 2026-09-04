---
name: mapa-guarda-copia-do-item
description: Item no mapaTatico é uma cópia congelada do catálogo — mexer no item depois não atualiza o mapa; como refrescar barato.
metadata: 
  node_type: memory
  type: project
  originSessionId: 1ad1a0c6-eeb4-480c-b250-36f05112ebb8
  modified: 2026-08-02T11:33:05.059Z
---

`aplicar-mapa.mjs` grava dentro do `mapaTatico` uma **cópia** do doc do catálogo
(`limparItem(c)`), não uma referência. Então mudar o item em `system/data/equipment`
depois de posicioná-lo — arte, preço, descrição — **não** chega aos mapas que já o têm.
Vale para o item solto e para os `itensDentro` de baú.

**How to apply:** para refrescar sem re-subir a imagem do mapa (que é o caro, e
ainda deixa um objeto órfão no Storage), rode o mesmo plano **sem as chaves `dd2vtt`
e `maxLargura`**. Sem `dd2vtt` o script preserva `url`, `imgW` e a geometria, e mesmo
assim re-resolve `npcs` e `itens` do banco. A conversão quadro→px continua idêntica
porque depende só de `imgW`/`larguraReal`, que já estão gravados.

Ordem certa quando o item é novo: cadastrar o item → **subir a arte** → só então
posicionar no mapa. Evita o refresh inteiro.

Relacionado: [[ler-mapas-dd2vtt]]
